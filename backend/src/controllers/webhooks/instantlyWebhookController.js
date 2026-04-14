const instantlyService = require('../../services/automation/instantlyService');
const db = require('../../config/database');

const handleWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    // In Instantly, we might need to identify the org by a secret in the URL
    // e.g., /api/webhooks/instantly/:orgId
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    console.log(`[Instantly Webhook] Received event for org ${orgId}:`, payload.event_type);

    await instantlyService.handleWebhook(orgId, payload);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Instantly Webhook] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  handleWebhook
};
