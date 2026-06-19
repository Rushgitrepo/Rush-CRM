const instantlyService = require('../../services/automation/instantlyService');
const db = require('../../config/database');

// ── Raw log table helper ─────────────────────────────────────────────────────
// Saves EVERY incoming request before any validation so we can diagnose issues.
async function _rawLog(orgId, headers, payload, status, note) {
  try {
    await db.query(
      `INSERT INTO instantly_webhook_raw_log
         (org_id, headers, payload, status, note, received_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        orgId || 'unknown',
        JSON.stringify(headers),
        JSON.stringify(payload),
        status,
        note,
      ]
    );
  } catch {
    // table might not exist yet — fail silently so the main flow is not broken
  }
}

// ── POST / or /:orgId  — called by Instantly.ai ─────────────────────────────
const handleWebhook = async (req, res, next) => {
  const payload = req.body;
  // URL param takes priority; fall back to INSTANTLY_ORG_ID env var
  const orgId = req.params.orgId || process.env.INSTANTLY_ORG_ID || null;

  console.log(`[Instantly Webhook] ▶ Incoming  org=${orgId}  event=${payload?.event_type}`);
  console.log(`[Instantly Webhook] ▶ Payload:`, JSON.stringify(payload));

  try {
    if (!orgId) {
      await _rawLog(null, req.headers, payload, 'rejected', 'missing orgId — set INSTANTLY_ORG_ID in .env');
      return res.status(400).json({ error: 'INSTANTLY_ORG_ID not configured in .env' });
    }

    // Optional secret check
    const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incoming =
        req.headers['x-webhook-id'] ||
        req.headers['x-instantly-webhook-id'] ||
        req.headers['x-webhook-secret'] ||
        payload?.webhook_id ||
        payload?.webhookId;

      if (incoming && incoming !== webhookSecret) {
        await _rawLog(orgId, req.headers, payload, 'rejected', `secret mismatch: got ${incoming}`);
        console.warn(`[Instantly Webhook] ✖ Secret mismatch for org ${orgId}`);
        return res.status(200).json({ success: false, ignored: true });
      }
    }

    // Verify org exists
    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      await _rawLog(orgId, req.headers, payload, 'rejected', 'org not found in DB');
      console.warn(`[Instantly Webhook] ✖ Unknown org_id ${orgId} — not in organizations table`);
      return res.status(200).json({ success: true, ignored: true, reason: 'unknown_org' });
    }

    // Ensure integration row is enabled (global .env key always wins)
    const globalApiKey = process.env.INSTANTLY_API_KEY;
    if (globalApiKey) {
      await db.query(
        `INSERT INTO instantly_integrations (org_id, api_key_encrypted, is_enabled, status, updated_at)
         VALUES ($1, $2, true, 'connected', now())
         ON CONFLICT (org_id) DO UPDATE SET
           api_key_encrypted = COALESCE(EXCLUDED.api_key_encrypted, instantly_integrations.api_key_encrypted),
           is_enabled        = true,
           status            = 'connected',
           updated_at        = now()`,
        [orgId, globalApiKey]
      );
    }

    await _rawLog(orgId, req.headers, payload, 'accepted', `event=${payload?.event_type}`);
    await instantlyService.handleWebhook(orgId, payload);

    console.log(`[Instantly Webhook] ✔ Processed  org=${orgId}  event=${payload?.event_type}`);
    res.status(200).json({ success: true });
  } catch (error) {
    await _rawLog(orgId, req.headers, payload, 'error', error.message);
    console.error('[Instantly Webhook] ✖ Error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
};

// ── GET /debug or /debug/:orgId — shows org status + recent logs ────────────
const debugWebhook = async (req, res) => {
  const orgId = req.params.orgId || process.env.INSTANTLY_ORG_ID || null;
  const result = { orgId, envOrgId: process.env.INSTANTLY_ORG_ID || null, checks: {}, recentLogs: [], recentEvents: [] };

  try {
    // 1. Does the org exist?
    const orgRow = await db.query('SELECT id, name FROM organizations WHERE id = $1', [orgId]);
    result.checks.orgExists = orgRow.rows.length > 0;
    result.checks.orgName   = orgRow.rows[0]?.name || null;

    // 2. Integration row
    const intRow = await db.query(
      'SELECT is_enabled, status, auto_add_leads, webhook_url FROM instantly_integrations WHERE org_id = $1',
      [orgId]
    );
    result.checks.integrationRow = intRow.rows[0] || null;
    result.checks.globalKeySet   = Boolean(process.env.INSTANTLY_API_KEY);

    // 3. Webhook health
    const healthRow = await db.query(
      'SELECT * FROM instantly_webhook_health WHERE org_id = $1', [orgId]
    );
    result.checks.webhookHealth = healthRow.rows[0] || { total_received: 0, total_processed: 0 };

    // 4. Recent raw logs (if table exists)
    try {
      const rawLogs = await db.query(
        `SELECT status, note, payload->>'event_type' AS event_type, received_at
         FROM instantly_webhook_raw_log
         WHERE org_id = $1 ORDER BY received_at DESC LIMIT 10`,
        [orgId]
      );
      result.recentLogs = rawLogs.rows;
    } catch { result.recentLogs = [{ note: 'raw log table not yet created — run migration' }]; }

    // 5. Recent processed events
    const eventsRow = await db.query(
      `SELECT event_type, sender_email, subject, processed, error_message, received_at
       FROM instantly_unibox_events WHERE org_id = $1 ORDER BY received_at DESC LIMIT 10`,
      [orgId]
    );
    result.recentEvents = eventsRow.rows;

    // 6. Expected webhook URL
    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    result.expectedWebhookUrl = `${appUrl}/api/webhooks/instantly/${orgId}`;

  } catch (err) {
    result.error = err.message;
  }

  res.json(result);
};

module.exports = { handleWebhook, debugWebhook };
