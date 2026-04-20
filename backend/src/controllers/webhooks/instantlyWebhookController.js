const instantlyService = require('../../services/automation/instantlyService');
const db = require('../../config/database');

const handleWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Verify org exists — if not, return 200 so Instantly stops retrying
    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      console.warn(`[Instantly Webhook] Unknown org_id ${orgId} — ignoring`);
      return res.status(200).json({ success: true, ignored: true });
    }

    console.log(`[Instantly Webhook] Received event for org ${orgId}:`, payload.event_type);

    await instantlyService.handleWebhook(orgId, payload);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Instantly Webhook] Error:', error);
    // Return 200 to prevent Instantly from retrying on application errors
    res.status(200).json({ success: false, error: error.message });
  }
};

module.exports = {
  handleWebhook
};
