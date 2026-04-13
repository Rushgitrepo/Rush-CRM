const googleExchangeCode = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    res.json({ error: 'Google integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const gmailExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'Gmail integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const googleCalendarExchangeCode = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body;
    res.json({ error: 'Google Calendar integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const microsoftExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'Microsoft integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const outlookExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'Outlook integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const onedriveExchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    res.json({ error: 'OneDrive integration not yet implemented', message: 'OAuth flow needs backend implementation' });
  } catch (error) {
    next(error);
  }
};

const instantlyService = require('../../services/automation/instantlyService');

const instantly = async (req, res, next) => {
  try {
    const { action, api_key, is_enabled } = req.body;
    const orgId = req.user.orgId;

    if (action === 'health') {
      const settings = await instantlyService.getSettings(orgId);
      const health = await instantlyService.getHealth(orgId);
      const recentEvents = await instantlyService.getRecentEvents(orgId);
      
      return res.json({ 
        integration: settings ? {
          ...settings,
          status: settings.api_key_encrypted ? 'connected' : 'disconnected'
        } : null,
        health: health,
        recent_events: recentEvents
      });
    }

    if (action === 'connect') {
      if (!api_key) {
        return res.status(400).json({ error: 'API Key is required' });
      }
      const settings = await instantlyService.saveSettings(orgId, { api_key, is_enabled: true });
      return res.json({ message: 'Instantly connected successfully', settings });
    }

    if (action === 'disconnect') {
      await instantlyService.disconnect(orgId);
      return res.json({ message: 'Instantly disconnected' });
    }

    if (action === 'toggle') {
      const settings = await instantlyService.saveSettings(orgId, { 
        api_key: (await instantlyService.getSettings(orgId))?.api_key_encrypted, 
        is_enabled 
      });
      return res.json({ message: `Instantly ${is_enabled ? 'enabled' : 'disabled'}`, settings });
    }

    if (action === 'sync') {
      const result = await instantlyService.syncEmails(orgId);
      return res.json({ message: 'Sync completed', ...result });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('[IntegrationsController] Instantly action failed:', error);
    
    // Return 400 for configuration issues, 500 for actual server errors
    if (error.message.includes('not configured or enabled')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  googleExchangeCode,
  gmailExchangeCode,
  googleCalendarExchangeCode,
  microsoftExchangeCode,
  outlookExchangeCode,
  onedriveExchangeCode,
  instantly,
};
