const { google } = require('googleapis');

class GoogleCalendarOAuthService {
  constructor() {
    this.oauth2Client = null;
    this.initializeOAuth();
  }

  initializeOAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Reverting to the calendar-specific redirect URI since it's registered in the console
    const redirectUri = process.env.GOOGLE_CALENDER_REDIRECT_URI;

    if (!clientId || !clientSecret || clientId.includes('your-')) {
      console.warn('⚠️  Google Calendar OAuth credentials not configured properly.');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('✅ Google Calendar OAuth initialized successfully');
  }

  getAuthUrl(state = null) {
    if (!this.oauth2Client) {
      this.initializeOAuth();
      if (!this.oauth2Client) throw new Error('Google Calendar OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state
    });

    return authUrl;
  }

  async exchangeCodeForTokens(code) {
    if (!this.oauth2Client) throw new Error('Google Calendar OAuth not configured');
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  async getUserInfo(accessToken) {
    if (!this.oauth2Client) throw new Error('Google Calendar OAuth not configured');
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

  async listEvents(tokens, timeMin, timeMax) {
    if (!this.oauth2Client) throw new Error('Google Calendar OAuth not configured');
    try {
      this.oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expires_at ? new Date(tokens.expires_at).getTime() : undefined
      });

      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error listing Google Calendar events:', error);
      throw new Error('Failed to fetch events from Google Calendar');
    }
  }
}

module.exports = new GoogleCalendarOAuthService();
