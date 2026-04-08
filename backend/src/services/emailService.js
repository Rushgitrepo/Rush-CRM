const db = require('../config/database');
const gmailOAuth = require('./gmailOAuth');

class EmailService {
  /**
   * Global send email function
   */
  async sendEmail(userId, { mailbox_id, to, cc, bcc, subject, body, html_body, attachments = [] }) {
    if (!mailbox_id) {
      // If no mailbox_id, try to find the primary/first active mailbox for the user
      const { rows } = await db.query(
        'SELECT id FROM connected_mailboxes WHERE user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      );
      if (rows.length === 0) throw new Error('No active mailbox found for user');
      mailbox_id = rows[0].id;
    }

    // 1. Get mailbox info
    const { rows } = await db.query(
      'SELECT * FROM connected_mailboxes WHERE id = $1 AND user_id = $2',
      [mailbox_id, userId]
    );

    if (rows.length === 0) throw new Error('Mailbox not found');
    const mailbox = rows[0];

    // 2. Refresh token if needed
    let accessToken = mailbox.access_token;
    if (mailbox.provider === 'gmail') {
      if (mailbox.token_expires_at && new Date(mailbox.token_expires_at) <= new Date()) {
        const tokens = await gmailOAuth.refreshAccessToken(mailbox.refresh_token);
        accessToken = tokens.access_token;
        
        await db.query(
          'UPDATE connected_mailboxes SET access_token = $1, token_expires_at = $2 WHERE id = $3',
          [accessToken, tokens.expiry_date ? new Date(tokens.expiry_date) : null, mailbox_id]
        );
      }

      // 3. Send via Gmail API
      const sentData = await gmailOAuth.sendEmail(accessToken, {
        to,
        cc,
        bcc,
        subject,
        body,
        html: html_body || body,
        attachments
      });

      // 4. Record in Sent folder (Internal)
      try {
        const gmailSyncService = require('./gmailSyncService');
        const msg = await gmailOAuth.getMessage(accessToken, sentData.id);
        await gmailSyncService.upsertMessage(msg, mailbox, userId, 'sent');
      } catch (syncErr) {
        console.error('Failed to sync sent message back to DB:', syncErr);
      }

      return { success: true, messageId: sentData.id };
    } else if (mailbox.provider === 'icloud' || mailbox.provider === 'custom_imap') {
      const nodemailer = require('nodemailer');
      
      const config = mailbox.provider === 'icloud' ? {
        host: mailbox.smtp_host && mailbox.smtp_host !== 'smtp.mail.me.com' ? mailbox.smtp_host : 'smtp.icloud.com',
        port: mailbox.smtp_port === 587 ? 465 : (mailbox.smtp_port || 465),
        secure: true, // Use implicit TLS on port 465 to bypass firewall blocks
        pool: true,
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        auth: {
          user: mailbox.smtp_username || mailbox.email_address || process.env.SMTP_USERNAME,
          pass: mailbox.encrypted_password || process.env.EMAIL_PASSWORD
        }
      } : {
        host: mailbox.smtp_host || process.env.SMTP_HOST,
        port: mailbox.smtp_port || parseInt(process.env.SMTP_PORT) || 587,
        secure: (mailbox.smtp_port || parseInt(process.env.SMTP_PORT) || 587) === 465,
        auth: {
          user: mailbox.smtp_username || mailbox.email_address || process.env.SMTP_USERNAME,
          pass: mailbox.encrypted_password || process.env.EMAIL_PASSWORD
        }
      };

      const transporter = nodemailer.createTransport(config);
      
      const info = await transporter.sendMail({
        from: mailbox.email_address,
        to,
        cc,
        bcc,
        subject,
        text: body,
        html: html_body || body,
        attachments: attachments.map(att => ({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.type
        }))
      });

      return { success: true, messageId: info.messageId };
    } else if (mailbox.provider === 'outlook' || mailbox.provider === 'microsoft') {
      // Placeholder for Microsoft Graph API
      throw new Error('Outlook email sending not yet implemented. Please use Gmail for now.');
    } else {
      throw new Error(`Unsupported email provider: ${mailbox.provider}`);
    }
  }
}


module.exports = new EmailService();
