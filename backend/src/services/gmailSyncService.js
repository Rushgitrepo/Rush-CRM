const db = require('../config/database');
const gmailOAuth = require('./gmailOAuth');

class GmailSyncService {
  async getAccessToken(mailboxId, userId) {
    const { rows } = await db.query(
      'SELECT * FROM connected_mailboxes WHERE id = $1 AND user_id = $2',
      [mailboxId, userId]
    );

    if (rows.length === 0) throw new Error('Mailbox not found');
    const mailbox = rows[0];

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
    return { accessToken, mailbox };
  }

  async syncMailbox(mailboxId, userId, fullSync = false) {
    console.log(`Syncing Gmail mailbox ${mailboxId} for user ${userId} (fullSync: ${fullSync})`);
    
    const { accessToken, mailbox } = await this.getAccessToken(mailboxId, userId);

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
    const limitPerFolder = fullSync ? 1000 : 50; // Increased limit for full sync

    for (const folder of folders) {
      let pageToken = null;
      let folderSynced = 0;

      do {
        const response = await gmailOAuth.listMessages(accessToken, folder.query, 100, pageToken);
        if (response.messages) {
          for (const msgSummary of response.messages) {
            try {
              const msg = await gmailOAuth.getMessage(accessToken, msgSummary.id);
              await this.upsertMessage(msg, mailbox, userId, folder.id);
              totalSynced++;
              folderSynced++;
            } catch (err) {
              console.error(`Failed to sync message ${msgSummary.id}:`, err.message);
            }
          }
        }
        pageToken = response.nextPageToken;
        // Stop if we hit the limit or no more pages
        if (folderSynced >= limitPerFolder) break;
      } while (pageToken && fullSync);
    }


    console.log(`Synced ${totalSynced} messages total for ${mailbox.email_address}`);

    await db.query(
      "UPDATE connected_mailboxes SET last_sync_at = now(), sync_status = 'synced' WHERE id = $1",
      [mailboxId]
    );

    return totalSynced;
  }

  async trashMessages(mailboxId, userId, messageIds) {
    const { accessToken } = await this.getAccessToken(mailboxId, userId);
    await gmailOAuth.trashMessages(accessToken, messageIds);
    
    // Update local DB
    await db.query(
      "UPDATE emails SET folder = 'trash' WHERE message_id = ANY($1) AND mailbox_id = $2",
      [messageIds, mailboxId]
    );
  }

  async permanentlyDeleteMessages(mailboxId, userId, messageIds) {
    const { accessToken } = await this.getAccessToken(mailboxId, userId);
    await gmailOAuth.deleteMessages(accessToken, messageIds);
    
    // Remove from local DB
    await db.query(
      "DELETE FROM emails WHERE message_id = ANY($1) AND mailbox_id = $2",
      [messageIds, mailboxId]
    );
  }

  async saveDraft(mailboxId, userId, draftData) {
    const { accessToken } = await this.getAccessToken(mailboxId, userId);
    const { to, subject, body, draft_id } = draftData;

    // If draft_id is local-only (starts with 'draft-'), we create it in Gmail
    // If it's a Gmail draft ID, we update it.
    
    let gmailDraft;
    if (draft_id && !draft_id.startsWith('draft-')) {
      gmailDraft = await gmailOAuth.updateDraft(accessToken, draft_id, { to, subject, html: body });
    } else {
      gmailDraft = await gmailOAuth.createDraft(accessToken, { to, subject, html: body });
    }

    // Update local DB with the real Gmail draft/message ID
    if (gmailDraft) {
      const realMessageId = gmailDraft.message.id;
      const realThreadId = gmailDraft.message.threadId;

      await db.query(
        `UPDATE emails SET message_id = $1, thread_id = $2, provider_id = $3 
         WHERE id = $4 OR message_id = $4`,
        [realMessageId, realThreadId, gmailDraft.id, draft_id]
      );

      return { success: true, gmail_draft_id: gmailDraft.id, message_id: realMessageId };
    }
  }

  decodeBase64(data) {
    if (!data) return '';
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  async upsertMessage(gmailMsg, mailbox, userId, folder) {
    const payload = gmailMsg.payload;
    const headers = payload.headers || [];
    
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
    
    const from = getHeader('From') || '';
    const to = getHeader('To') || '';
    const subject = getHeader('Subject') || '';
    const date = getHeader('Date') ? new Date(getHeader('Date')) : new Date();
    
    let body = '';
    let htmlBody = '';
    
    const extractBody = (part) => {
      if (part.mimeType === 'text/plain' && part.body.data) {
        body = this.decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body.data) {
        htmlBody = this.decodeBase64(part.body.data);
      }
      if (part.parts) part.parts.forEach(p => extractBody(p));
    };

    if (payload) extractBody(payload);

    if (!body && !htmlBody && gmailMsg.snippet) body = gmailMsg.snippet;

    const snippet = gmailMsg.snippet;
    const isRead = !gmailMsg.labelIds?.includes('UNREAD');
    const isStarred = gmailMsg.labelIds?.includes('STARRED');

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
      if (part.parts) part.parts.forEach(p => collectAttachments(p));
    };
    if (payload) collectAttachments(payload);

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
        userId, mailbox.id, mailbox.org_id, from, to, subject, body, htmlBody, 
        snippet, isRead, isStarred, folder, gmailMsg.threadId, gmailMsg.id, 
        JSON.stringify(attachments), attachments.length > 0, date, gmailMsg.labelIds
      ]
    );
  }
}

module.exports = new GmailSyncService();



