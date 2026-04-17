const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../config/database');

// Lazily required to avoid circular deps at startup
const getRealtimeService = () => require('./realtimeService');

const FOLDER_DB_MAP = {
  'inbox': 'inbox',
  'sent': 'sent',
  'sent messages': 'sent',
  'drafts': 'drafts',
  'trash': 'trash',
  'deleted messages': 'trash',
  'deleted items': 'trash',
  'junk': 'spam',
  'spam': 'spam',
  'junk e-mail': 'spam',
  'junk mail': 'spam',
  'archive': 'archive',
  'archived': 'archive',
};

class ImapIdleService {
  constructor() {
    // mailboxId -> { running: boolean }
    this.watchers = new Map();
  }

  /**
   * Load all active IMAP mailboxes from DB and start watching them.
   * Called once at server startup.
   */
  async startAll() {
    try {
      const { rows } = await db.query(
        `SELECT * FROM connected_mailboxes
         WHERE is_active = true
           AND access_token IS NULL
           AND encrypted_password IS NOT NULL`
      );
      console.log(`📬 Starting real-time IMAP watchers for ${rows.length} mailbox(es)`);
      for (const mailbox of rows) {
        this.watch(mailbox);
      }
    } catch (err) {
      console.error('ImapIdleService.startAll failed:', err.message);
    }
  }

  /**
   * Start watching a single mailbox. Safe to call multiple times (idempotent).
   */
  watch(mailbox) {
    if (this.watchers.has(mailbox.id)) return;
    const state = { running: true };
    this.watchers.set(mailbox.id, state);
    this._loop(mailbox, state).catch(() => {});
  }

  /**
   * Stop watching a mailbox (e.g. when disconnected).
   */
  stopWatch(mailboxId) {
    const state = this.watchers.get(mailboxId);
    if (state) {
      state.running = false;
      this.watchers.delete(mailboxId);
    }
  }

  stopAll() {
    for (const state of this.watchers.values()) {
      state.running = false;
    }
    this.watchers.clear();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  async _loop(mailbox, state) {
    const RECONNECT_DELAY = 30_000; // 30 s between reconnect attempts

    while (state.running) {
      const client = new ImapFlow({
        host: mailbox.imap_host || 'imap.mail.me.com',
        port: mailbox.imap_port || 993,
        secure: (mailbox.imap_port || 993) === 993,
        auth: {
          user: mailbox.imap_username || mailbox.email_address,
          pass: mailbox.encrypted_password,
        },
        tls: { rejectUnauthorized: false },
        logger: false,
      });

      try {
        await client.connect();
        await client.mailboxOpen('INBOX');
        console.log(`📬 IMAP IDLE watching: ${mailbox.email_address}`);

        // Catch up: sync any messages received since the last manual sync
        await this._fetchNew(client, mailbox);

        while (state.running) {
          // Blocks until server pushes a notification OR ~9-minute timeout.
          // Returns true if the server sent a notification (new mail, flag change, etc.)
          const notified = await client.idle();

          if (!state.running) break;

          if (notified) {
            await this._fetchNew(client, mailbox);
          }
          // If not notified (timeout), the loop continues and calls idle() again,
          // which keeps the connection alive.
        }
      } catch (err) {
        if (state.running) {
          console.warn(
            `IMAP IDLE lost for ${mailbox.email_address}: ${err.message}. Reconnecting in 30 s…`
          );
          await new Promise((r) => setTimeout(r, RECONNECT_DELAY));
        }
      } finally {
        try { await client.logout(); } catch {}
      }
    }

    this.watchers.delete(mailbox.id);
  }

  async _fetchNew(client, mailbox) {
    try {
      // Search for unseen messages in the last 10 minutes (catch-up window)
      const since = new Date(Date.now() - 10 * 60 * 1000);
      const uids = await client.search({ unseen: true, since });
      if (!uids || uids.length === 0) return;

      // Limit to 20 newest to avoid overwhelming the connection
      const batch = uids.slice(-20);

      for await (const msg of client.fetch(batch, { envelope: true, source: true })) {
        try {
          const parsed = await simpleParser(msg.source);
          const messageId = msg.envelope.messageId || `imap-${mailbox.id}-${msg.uid}`;

          const { rows } = await db.query(
            `INSERT INTO emails (
               org_id, user_id, mailbox_id, message_id, thread_id,
               from_email, to_email, subject, body, html_body,
               snippet, received_at, folder, is_read, has_attachments
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'inbox',$13,$14)
             ON CONFLICT (message_id) DO NOTHING
             RETURNING *`,
            [
              mailbox.org_id,
              mailbox.user_id,
              mailbox.id,
              messageId,
              messageId,
              msg.envelope.from?.[0]?.address || '',
              msg.envelope.to?.[0]?.address || '',
              msg.envelope.subject || '(No Subject)',
              parsed.text || '',
              parsed.html || '',
              parsed.text?.substring(0, 150) || '',
              msg.envelope.date || new Date(),
              msg.flags?.has('\\Seen') || false,
              parsed.attachments?.length > 0,
            ]
          );

          if (rows.length > 0) {
            console.log(`📨 New email: "${msg.envelope.subject}" → ${mailbox.email_address}`);
            getRealtimeService().broadcastToOrg(mailbox.org_id, 'email:new', {
              mailbox_id: mailbox.id,
              email: rows[0],
            });

            // Update last_sync_at
            await db.query(
              `UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1`,
              [mailbox.id]
            );
          }
        } catch (msgErr) {
          console.error(`Failed to save message uid=${msg.uid}:`, msgErr.message);
        }
      }
    } catch (err) {
      console.error(`_fetchNew failed for ${mailbox.email_address}:`, err.message);
    }
  }
}

module.exports = new ImapIdleService();
