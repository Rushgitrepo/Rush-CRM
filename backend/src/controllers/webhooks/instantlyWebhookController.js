const instantlyService = require('../../services/automation/instantlyService');
const db = require('../../config/database');

const handleWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Optional: verify INSTANTLY_WEBHOOK_SECRET if configured.
    // Instantly sends the webhook ID as X-Webhook-Id or inside the payload.
    const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incoming =
        req.headers['x-webhook-id'] ||
        req.headers['x-instantly-webhook-id'] ||
        req.headers['x-webhook-secret'] ||
        payload?.webhook_id ||
        payload?.webhookId;

      if (incoming && incoming !== webhookSecret) {
        console.warn('[Instantly Webhook] Secret mismatch — rejecting request');
        return res.status(200).json({ success: false, ignored: true });
      }
      // If Instantly sends no secret header at all, we still allow through
      // (the orgId UUID in the URL already acts as a secret)
    }

    // Verify org exists — return 200 so Instantly does not keep retrying
    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      console.warn(`[Instantly Webhook] Unknown org_id ${orgId} — ignoring`);
      return res.status(200).json({ success: true, ignored: true });
    }

    console.log(`[Instantly Webhook] Received event for org ${orgId}:`, payload.event_type);

    // Ensure the integration row exists and is enabled so handleWebhook doesn't skip it.
    // When INSTANTLY_API_KEY is set globally in .env, upsert a row with is_enabled=true
    // so the webhook proceeds even if a previous DB row had is_enabled=false.
    const globalApiKey = process.env.INSTANTLY_API_KEY;
    if (globalApiKey) {
      await db.query(
        `INSERT INTO instantly_integrations (org_id, api_key_encrypted, is_enabled, status, updated_at)
         VALUES ($1, $2, true, 'connected', now())
         ON CONFLICT (org_id) DO UPDATE SET
           api_key_encrypted = COALESCE(EXCLUDED.api_key_encrypted, instantly_integrations.api_key_encrypted),
           is_enabled = true,
           status = 'connected',
           updated_at = now()`,
        [orgId, globalApiKey]
      );
    }

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
