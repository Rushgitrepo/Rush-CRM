const { google } = require('googleapis');

class GmailOAuthService {
  constructor() {
    this.oauth2Client = null;
    this.initializeOAuth();
  }

  initializeOAuth() {
    // Check if Google OAuth credentials are configured
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    // Check for placeholder values
    const isPlaceholder = (value) => {
      return !value || 
             value === 'your-google-client-id-here' || 
             value === 'your-google-client-secret-here' ||
             value.includes('your-') ||
             value.includes('placeholder');
    };

    if (!clientId || !clientSecret || isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
      console.warn('⚠️  Google OAuth credentials not configured properly.');
      console.warn('   Current GOOGLE_CLIENT_ID:', clientId ? `${clientId.substring(0, 10)}...` : 'not set');
      console.warn('   Current GOOGLE_CLIENT_SECRET:', clientSecret ? 'set but may be placeholder' : 'not set');
      console.warn('   Please follow these steps:');
      console.warn('   1. Go to https://console.cloud.google.com/');
      console.warn('   2. Create OAuth 2.0 credentials');
      console.warn('   3. Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
      console.warn('   4. Restart the server');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('✅ Google OAuth initialized successfully');
  }

  /**
   * Generate OAuth URL for Gmail authentication
   */
  getAuthUrl(state = null) {
    if (!this.oauth2Client) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || clientId === 'your-google-client-id-here') {
        throw new Error('Google Client ID not configured. Please set GOOGLE_CLIENT_ID in your .env file with a real value from Google Cloud Console.');
      }
      
      if (!clientSecret || clientSecret === 'your-google-client-secret-here') {
        throw new Error('Google Client Secret not configured. Please set GOOGLE_CLIENT_SECRET in your .env file with a real value from Google Cloud Console.');
      }
      
      throw new Error('Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.');
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state // Can be used to pass user/org info
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }

    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      return data;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw new Error('Failed to get user information from Google');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }

    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Test Gmail API connection
   */
  async testConnection(accessToken) {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }

    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      // Try to get user profile to test connection
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return {
        success: true,
        emailAddress: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal
      };
    } catch (error) {
      console.error('Error testing Gmail connection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List messages from Gmail
   */
  async listMessages(accessToken, query = '', maxResults = 50) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxResults
    });

    return response.data;
  }

  /**
   * Get detailed message from Gmail
   */
  async getMessage(accessToken, messageId) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    return response.data;
  }

  /**
   * Update message labels in Gmail
   */
  async updateLabels(accessToken, messageId, addLabelIds = [], removeLabelIds = []) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    await gmail.users.messages.batchModify({
      userId: 'me',
      ids: [messageId],
      addLabelIds,
      removeLabelIds
    });
  }

  /**
   * Send an email via Gmail API
   */
  async sendEmail(accessToken, { to, cc, bcc, subject, body, html, attachments = [] }) {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const boundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    
    let message = '';
    
    if (attachments.length > 0) {
      // Multipart message
      message += `To: ${to}\n`;
      if (cc) message += `Cc: ${cc}\n`;
      if (bcc) message += `Bcc: ${bcc}\n`;
      message += `Subject: ${utf8Subject}\n`;
      message += `MIME-Version: 1.0\n`;
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`;

      // Body part
      message += `--${boundary}\n`;
      message += `Content-Type: text/html; charset=utf-8\n`;
      message += `Content-Transfer-Encoding: 7bit\n\n`;
      message += `${html || body}\n\n`;

      // Attachment parts
      for (const att of attachments) {
        message += `--${boundary}\n`;
        message += `Content-Type: ${att.type || 'application/octet-stream'}; name="${att.filename}"\n`;
        message += `Content-Transfer-Encoding: base64\n`;
        message += `Content-Disposition: attachment; filename="${att.filename}"\n\n`;
        message += `${att.content}\n\n`;
      }
      
      message += `--${boundary}--`;
    } else {
      // Simple message
      const messageParts = [
        `To: ${to}`,
        cc ? `Cc: ${cc}` : null,
        bcc ? `Bcc: ${bcc}` : null,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        html || body,
      ].filter(Boolean);
      message = messageParts.join('\n');
    }

    // The body needs to be base64url encoded
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return response.data;
  }

}


module.exports = new GmailOAuthService();