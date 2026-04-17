require('dotenv').config();
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ImapSyncService {
  /**
   * Verify IMAP credentials and server connectivity
   */
  async verifyConnection(config) {
    const email = config.email_address || process.env.IMAP_USERNAME;
    const username = config.imap_username || email;
    const password = config.encrypted_password || process.env.EMAIL_PASSWORD;

    const client = new ImapFlow({
      host: config.imap_host || process.env.IMAP_HOST || 'imap.mail.me.com',
      port: config.imap_port || parseInt(process.env.IMAP_PORT) || 993,
      secure: (config.imap_port || parseInt(process.env.IMAP_PORT) || 993) === 993,
      auth: { user: username, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false
    });

    try {
      await client.connect();
      await client.logout();
      return { verified: true };
    } catch (err) {
      console.error('IMAP Verification Error:', err);
      return { verified: false, error: err.message };
    }
  }

  async getClient(mailboxId) {
    const { rows } = await db.query('SELECT * FROM connected_mailboxes WHERE id = $1', [mailboxId]);
    if (rows.length === 0) throw new Error('Mailbox not found');
    const mailbox = rows[0];

    const client = new ImapFlow({
      host: mailbox.imap_host || process.env.IMAP_HOST || 'imap.mail.me.com',
      port: mailbox.imap_port || parseInt(mailbox.imap_port) || 993,
      secure: (mailbox.imap_port || parseInt(mailbox.imap_port) || 993) === 993,
      auth: {
        user: mailbox.imap_username || mailbox.email_address || process.env.IMAP_USERNAME,
        pass: mailbox.encrypted_password || process.env.EMAIL_PASSWORD
      },
      tls: { rejectUnauthorized: false },
      logger: false
    });
    return { client, mailbox };
  }

  /**
   * Sync a mailbox from the IMAP server
   */
  async syncMailbox(mailboxId, userId, fullSync = false) {
    const { client, mailbox } = await this.getClient(mailboxId);

    const FOLDER_DB_MAP = {
      'inbox': 'inbox', 'sent': 'sent', 'sent messages': 'sent', '[gmail]/sent mail': 'sent',
      'drafts': 'drafts', '[gmail]/drafts': 'drafts', 'trash': 'trash', 'deleted messages': 'trash',
      'deleted items': 'trash', '[gmail]/trash': 'trash', 'junk': 'spam', 'spam': 'spam',
      'junk e-mail': 'spam', 'junk mail': 'spam', '[gmail]/spam': 'spam', 'archive': 'archive',
      'archived': 'archive', '[gmail]/all mail': 'archive',
    };

    function resolveDbFolder(folderPath) {
      const lower = folderPath.toLowerCase();
      if (FOLDER_DB_MAP[lower]) return FOLDER_DB_MAP[lower];
      if (lower.includes('sent')) return 'sent';
      if (lower.includes('draft')) return 'drafts';
      if (lower.includes('trash') || lower.includes('deleted')) return 'trash';
      if (lower.includes('junk') || lower.includes('spam')) return 'spam';
      if (lower.includes('archive')) return 'archive';
      if (lower === 'inbox') return 'inbox';
      return null;
    }

    try {
      await client.connect();
      const availableFolders = await client.list();
      const foldersToSync = availableFolders
        .map(f => {
          const path = f.path || f.name;
          return { path, dbFolder: resolveDbFolder(path) };
        })
        .filter(f => f.dbFolder !== null);

      let syncedCount = 0;
      const limitPerFolder = fullSync ? 1000 : 100;

      for (const { path: folderPath, dbFolder } of foldersToSync) {
        let lock;
        try {
          lock = await client.getMailboxLock(folderPath);
          const since = fullSync ? null : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const searchCriteria = since ? { since } : { all: true };
          let uids = await client.search(searchCriteria);

          if (uids && uids.length > 0) {
            if (uids.length > limitPerFolder) uids = uids.slice(-limitPerFolder);
            for await (const msg of client.fetch(uids, { envelope: true, source: true })) {
              try {
                const parsed = await simpleParser(msg.source);
                const messageId = msg.envelope.messageId || `imap-${mailboxId}-${dbFolder}-${msg.uid}`;

                const { rowCount } = await db.query(
                  `INSERT INTO emails (
                    org_id, user_id, mailbox_id, message_id, thread_id,
                    from_email, to_email, subject, body, html_body,
                    snippet, received_at, folder, is_read, has_attachments
                  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                  ON CONFLICT (message_id) 
                  DO UPDATE SET folder = EXCLUDED.folder, is_read = EXCLUDED.is_read`,
                  [
                    mailbox.org_id, userId, mailbox.id, messageId, messageId,
                    msg.envelope.from?.[0]?.address || '', msg.envelope.to?.[0]?.address || '',
                    msg.envelope.subject || '(No Subject)', parsed.text || '', parsed.html || '',
                    parsed.text?.substring(0, 150) || '', msg.envelope.date || new Date(),
                    dbFolder, msg.flags?.has('\\Seen') || false, parsed.attachments?.length > 0,
                  ]
                );
                if (rowCount > 0) syncedCount++;
              } catch (msgErr) {
                console.error(`Failed msg uid=${msg.uid} in ${folderPath}:`, msgErr.message);
              }
            }
          }
        } catch (err) {
          console.warn(`[imap-sync] Folder "${folderPath}" inaccessible:`, err.message);
        } finally {
          if (lock) lock.release();
        }
      }

      await db.query(
        "UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1",
        [mailboxId]
      );
      return syncedCount;
    } catch (err) {
      console.error('Sync failed:', err);
      await db.query("UPDATE connected_mailboxes SET sync_status = 'error' WHERE id = $1", [mailboxId]);
      throw err;
    } finally {
      await client.logout();
    }
  }

  async trashMessages(mailboxId, userId, messageIds) {
    const { client } = await this.getClient(mailboxId);
    try {
      await client.connect();
      
      const { rows } = await db.query('SELECT message_id, folder FROM emails WHERE message_id = ANY($1)', [messageIds]);
      const list = await client.list();
      const trashFolder = list.find(f => f.name.toLowerCase().includes('trash') || f.path.toLowerCase().includes('trash'));
      
      if (trashFolder) {
        for (const row of rows) {
          // We need current folder to open it and move message
          let lock;
          try {
            lock = await client.getMailboxLock(row.folder === 'inbox' ? 'INBOX' : row.folder);
            // Search for the message by Message-ID header
            const uids = await client.search({ header: { 'Message-ID': row.message_id } });
            if (uids && uids.length > 0) {
              await client.messageMove(uids[0], trashFolder.path);
            }
          } catch (err) {
            console.warn(`Could not move message ${row.message_id} to trash:`, err.message);
          } finally {
            if (lock) lock.release();
          }
        }
      }
      
      await db.query("UPDATE emails SET folder = 'trash' WHERE message_id = ANY($1)", [messageIds]);
    } finally {
      await client.logout();
    }
  }

  async permanentlyDeleteMessages(mailboxId, userId, messageIds) {
    const { client } = await this.getClient(mailboxId);
    try {
      await client.connect();
      const { rows } = await db.query('SELECT message_id, folder FROM emails WHERE message_id = ANY($1)', [messageIds]);
      
      for (const row of rows) {
        let lock;
        try {
          lock = await client.getMailboxLock(row.folder === 'trash' ? 'Trash' : (row.folder === 'inbox' ? 'INBOX' : row.folder));
          const uids = await client.search({ header: { 'Message-ID': row.message_id } });
          if (uids && uids.length > 0) {
            await client.messageDelete(uids[0]);
          }
        } catch (err) {
          console.warn(`Could not delete message ${row.message_id}:`, err.message);
        } finally {
          if (lock) lock.release();
        }
      }
      await db.query("DELETE FROM emails WHERE message_id = ANY($1)", [messageIds]);
    } finally {
      await client.logout();
    }
  }


  async saveDraft(mailboxId, userId, draftData) {
    const { client } = await this.getClient(mailboxId);
    const { to, subject, body } = draftData;
    try {
      await client.connect();
      const list = await client.list();
      const draftsFolder = list.find(f => f.name.toLowerCase().includes('draft') || f.path.toLowerCase().includes('draft'));
      
      if (draftsFolder) {
        const raw = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}`;
        await client.append(draftsFolder.path, raw, ['\\Draft']);
      }
      return { success: true };
    } finally {
      await client.logout();
    }
  }
}

module.exports = new ImapSyncService();