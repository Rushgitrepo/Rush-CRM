const db = require('../config/database');
const gmailOAuth = require('./gmailOAuth');

class GmailSyncService {
  async syncMailbox(mailboxId, userId, fullSync = false) {
    console.log(`Syncing Gmail mailbox ${mailboxId} for user ${userId}`);
    
    const { rows } = await db.query(
      'SELECT * FROM connected_mailboxes WHERE id = $1 AND user_id = $2 AND provider = $3',
      [mailboxId, userId, 'gmail']
    );

    if (rows.length === 0) throw new Error('Mailbox not found');
    const mailbox = rows[0];

    // Refresh token if needed? (gmailOAuth usually handles it or we do it here)
    let accessToken = mailbox.access_token;
    
    // Check if token expired
    if (mailbox.token_expires_at && new Date(mailbox.token_expires_at) <= new Date()) {
      console.log('Access token expired, refreshing...');
      const tokens = await gmailOAuth.refreshAccessToken(mailbox.refresh_token);
      accessToken = tokens.access_token;
      
      await db.query(
        'UPDATE connected_mailboxes SET access_token = $1, token_expires_at = $2, updated_at = now() WHERE id = $3',
        [accessToken, tokens.expiry_date ? new Date(tokens.expiry_date) : null, mailboxId]
      );
    }

    const folders = [
      { id: 'inbox', query: 'label:INBOX' },
      { id: 'sent', query: 'label:SENT' },
      { id: 'drafts', query: 'label:DRAFT' },
      { id: 'starred', query: 'is:starred' },
      { id: 'archive', query: '-label:INBOX -label:TRASH -label:SPAM' },
      { id: 'spam', query: 'label:SPAM' },
      { id: 'trash', query: 'label:TRASH' }
    ];

    let totalSynced = 0;

    for (const folder of folders) {
      const messages = await gmailOAuth.listMessages(accessToken, folder.query, fullSync ? 100 : 20);
      if (messages.messages) {
        for (const msgSummary of messages.messages) {
          try {
            const msg = await gmailOAuth.getMessage(accessToken, msgSummary.id);
            await this.upsertMessage(msg, mailbox, userId, folder.id);
            totalSynced++;
          } catch (err) {
            console.error(`Failed to sync message ${msgSummary.id}:`, err.message);
          }
        }
      }
    }

    console.log(`Synced ${totalSynced} messages for ${mailbox.email_address}`);

    await db.query(
      "UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1",
      [mailboxId]
    );

    return totalSynced;
  }

  decodeBase64(data) {
    if (!data) return '';
    // Gmail uses base64url, which replaces + with - and / with _
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  async upsertMessage(gmailMsg, mailbox, userId, folder) {
    const payload = gmailMsg.payload;
    const headers = payload.headers;
    
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
    
    const from = getHeader('From') || '';
    const to = getHeader('To') || '';
    const subject = getHeader('Subject') || '';
    const date = getHeader('Date') ? new Date(getHeader('Date')) : new Date();
    
    // Extract body (this is a simplified version, Gmail body can be complex)
    let body = '';
    let htmlBody = '';
    
    const extractBody = (part) => {
      if (part.mimeType === 'text/plain' && part.body.data) {
        body = this.decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body.data) {
        htmlBody = this.decodeBase64(part.body.data);
      }
      
      if (part.parts) {
        part.parts.forEach(p => extractBody(p));
      }
    };

    extractBody(payload);

    if (!body && !htmlBody && gmailMsg.snippet) {
      body = gmailMsg.snippet;
    }

    const snippet = gmailMsg.snippet;
    const isRead = !gmailMsg.labelIds?.includes('UNREAD');
    const isStarred = gmailMsg.labelIds?.includes('STARRED');

    // Extract attachments metadata
    const attachments = [];
    const collectAttachments = (part) => {
      if (part.filename && part.body.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size
        });
      }
      if (part.parts) {
        part.parts.forEach(p => collectAttachments(p));
      }
    };
    collectAttachments(payload);

    await db.query(
      `INSERT INTO emails (
        user_id, mailbox_id, org_id, from_email, to_email, subject, body, html_body, 
        snippet, is_read, is_starred, folder, thread_id, message_id, 
        attachments, has_attachments, received_at, labels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (message_id) 
      DO UPDATE SET 
        folder = CASE WHEN EXCLUDED.folder = 'inbox' AND emails.folder != 'inbox' THEN emails.folder ELSE EXCLUDED.folder END,
        is_read = EXCLUDED.is_read,
        is_starred = EXCLUDED.is_starred,
        updated_at = now()`,
      [
        userId,
        mailbox.id,
        mailbox.org_id,
        from,
        to,
        subject,
        body,
        htmlBody,
        snippet,
        isRead,
        isStarred,
        folder,
        gmailMsg.threadId,
        gmailMsg.id,
        JSON.stringify(attachments),
        attachments.length > 0,
        date,
        gmailMsg.labelIds
      ]
    );
  }
}

module.exports = new GmailSyncService();


