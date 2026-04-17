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
    if (mailbox.provider === 'gmail' && accessToken) {
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
    } else {
      // SMTP Sending for other providers or custom SMTP
      const nodemailer = require('nodemailer');
      
      let config = {};
      
      if (mailbox.provider === 'icloud') {
        config = {
          host: mailbox.smtp_host || 'smtp.mail.me.com',
          port: mailbox.smtp_port || 587,
          secure: (mailbox.smtp_port === 465),
          auth: {
            user: mailbox.smtp_username || mailbox.email_address,
            pass: mailbox.encrypted_password
          }
        };
      } else if (['outlook', 'office365', 'microsoft'].includes(mailbox.provider) && !mailbox.access_token) {
        // If no OAuth token, use SMTP
        config = {
          host: mailbox.smtp_host || 'smtp.office365.com',
          port: mailbox.smtp_port || 587,
          secure: false,
          tls: { ciphers: 'SSLv3' },
          auth: {
            user: mailbox.smtp_username || mailbox.email_address,
            pass: mailbox.encrypted_password
          }
        };
      } else if (mailbox.provider === 'yahoo') {
        config = {
          host: mailbox.smtp_host || 'smtp.mail.yahoo.com',
          port: mailbox.smtp_port || 465,
          secure: true,
          auth: {
            user: mailbox.smtp_username || mailbox.email_address,
            pass: mailbox.encrypted_password
          }
        };
      } else {
        // Custom SMTP or Fallback
        config = {
          host: mailbox.smtp_host || process.env.SMTP_HOST,
          port: mailbox.smtp_port || parseInt(process.env.SMTP_PORT) || 587,
          secure: (mailbox.smtp_port === 465 || process.env.SMTP_PORT === '465'),
          auth: {
            user: mailbox.smtp_username || mailbox.email_address || process.env.SMTP_USERNAME,
            pass: mailbox.encrypted_password || process.env.EMAIL_PASSWORD
          }
        };
      }

      const transporter = nodemailer.createTransport(config);
      
      const info = await transporter.sendMail({
        from: `"${mailbox.display_name || ''}" <${mailbox.email_address}>`,
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
    }
  }

  /**
   * Verify SMTP Connection
   */
  async verifySMTP(config) {
    const nodemailer = require('nodemailer');
    
    const smtpConfig = {
      host: config.smtp_host,
      port: config.smtp_port || 587,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_username || config.email_address,
        pass: config.encrypted_password
      },
      connectionTimeout: 10000 // 10s timeout
    };

    const transporter = nodemailer.createTransport(smtpConfig);
    
    try {
      await transporter.verify();
      return { verified: true };
    } catch (err) {
      console.error('SMTP Verification Error:', err);
      return { verified: false, error: err.message };
    }
  }

}


module.exports = new EmailService();
