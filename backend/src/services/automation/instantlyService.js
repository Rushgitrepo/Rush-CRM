const db = require('../../config/database');

class InstantlyService {
  constructor() {
    this.baseUrl = 'https://api.instantly.ai/api/v2';
  }

  /**
   * Get integration settings for an organization
   */
  async getSettings(orgId) {
    const result = await db.query(
      'SELECT * FROM instantly_integrations WHERE org_id = $1',
      [orgId]
    );
    let settings = result.rows[0];
    
    // If no org-specific settings, but we have a global key in .env
    const globalApiKey = process.env.INSTANTLY_API_KEY;
    
    if (!settings && globalApiKey) {
      // Auto-create/return virtual settings using global key
      settings = {
        org_id: orgId,
        api_key_encrypted: globalApiKey,
        is_enabled: true,
        status: 'connected',
        is_global: true
      };
    } else if (settings && globalApiKey && !settings.api_key_encrypted) {
      // Use global key if local one is missing
      settings.api_key_encrypted = globalApiKey;
      settings.is_global = true;
    }

    if (settings && !settings.webhook_url) {
      const appUrl = process.env.APP_URL || 'http://localhost:4000';
      settings.webhook_url = `${appUrl}/api/webhooks/instantly/${orgId}`;
      
      // Update it in background
      db.query(
        'UPDATE instantly_integrations SET webhook_url = $1 WHERE org_id = $2',
        [settings.webhook_url, orgId]
      ).catch(err => console.error('Failed to update webhook URL:', err));
    }
    
    return settings;
  }

  /**
   * Get webhook health status
   */
  async getHealth(orgId) {
    const result = await db.query(
      'SELECT * FROM instantly_webhook_health WHERE org_id = $1',
      [orgId]
    );
    return result.rows[0] || {
      status: 'unknown',
      total_received: 0,
      total_processed: 0,
      total_failed: 0,
      last_received_at: null,
      last_error: null
    };
  }

  /**
   * Get recent events
   */
  async getRecentEvents(orgId, limit = 5) {
    const result = await db.query(
      'SELECT * FROM instantly_unibox_events WHERE org_id = $1 ORDER BY received_at DESC LIMIT $2',
      [orgId, limit]
    );
    return result.rows;
  }

  /**
   * Save integration settings
   */
  async saveSettings(orgId, { api_key, is_enabled }) {
    // In a real app, we'd encrypt the API key
    // For now, satisfy the requirement by storing it
    const query = `
      INSERT INTO instantly_integrations (org_id, api_key_encrypted, is_enabled, status, updated_at)
      VALUES ($1, $2, $3, 'connected', now())
      ON CONFLICT (org_id) DO UPDATE SET
        api_key_encrypted = EXCLUDED.api_key_encrypted,
        is_enabled = EXCLUDED.is_enabled,
        status = 'connected',
        updated_at = now()
      RETURNING *
    `;
    const result = await db.query(query, [orgId, api_key, is_enabled]);
    return result.rows[0];
  }

  /**
   * Disconnect integration
   */
  async disconnect(orgId) {
    await db.query(
      "UPDATE instantly_integrations SET is_enabled = false, status = 'disconnected', updated_at = now() WHERE org_id = $1",
      [orgId]
    );
  }

  /**
   * Sync Unibox emails from Instantly
   * Note: Instantly V2 API for emails might have different pagination etc.
   */
  async syncEmails(orgId) {
    const settings = await this.getSettings(orgId);
    if (!settings || !settings.api_key_encrypted || !settings.is_enabled) {
      throw new Error('Instantly integration not configured or enabled');
    }

    const apiKey = settings.api_key_encrypted; // Should decrypt here

    try {
      // Example call to Instantly API (assuming /emails is the correct endpoint)
      // Based on research: GET /api/v2/emails
      const response = await fetch(`${this.baseUrl}/emails?limit=50`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const emails = data.items || data.data || [];
      console.log(`[Instantly Service] Syncing ${emails.length} emails for org ${orgId}...`);
      
      let syncCount = 0;

      for (const email of emails) {
        const externalId = (email.id || email.message_id).toString();
        
        // Check if email already exists to avoid duplicates
        const existing = await db.query(
          'SELECT id FROM unibox_emails WHERE message_id = $1 AND org_id = $2',
          [externalId, orgId]
        );

        if (existing.rows.length === 0) {
          await db.query(
            `INSERT INTO unibox_emails (
              org_id, message_id, sender_email, sender_name, subject, body_text, 
              status, priority, received_at, is_read, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              orgId,
              externalId,
              email.from_address_email || email.sender || email.eaccount,
              email.sender_name || email.from_name || email.eaccount?.split('@')[0],
              email.subject,
              email.body?.html || email.body_text || email.body || '',
              'New',
              'normal',
              new Date(email.timestamp_email || email.received_at || Date.now()),
              false,
              JSON.stringify(email)
            ]
          );
          syncCount++;
        }
      }

      await db.query(
        'UPDATE instantly_integrations SET last_sync_at = now() WHERE org_id = $1',
        [orgId]
      );

      return { total: emails.length, synced: syncCount };
    } catch (error) {
      console.error('[Instantly Service] Sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Process incoming webhook event
   */
  async handleWebhook(orgId, payload) {
    // Log the event
    await db.query(
      `INSERT INTO instantly_unibox_events (
        org_id, event_type, payload, sender_email, sender_name, subject, body_text, processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [
        orgId,
        payload.event_type || 'reply_received',
        JSON.stringify(payload),
        payload.sender || payload.from_email,
        payload.sender_name || payload.from_name,
        payload.subject,
        payload.body_text || payload.body
      ]
    );

    if (payload.event_type === 'reply_received' || !payload.event_type) {
      const externalId = (payload.id || payload.message_id || `inst-${Date.now()}`).toString();
      
      // Create record in unibox_emails
      await db.query(
        `INSERT INTO unibox_emails (
          org_id, message_id, sender_email, sender_name, subject, body_text, 
          status, priority, received_at, is_read, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          orgId,
          externalId,
          payload.from_address_email || payload.sender || payload.eaccount,
          payload.sender_name || payload.from_name || payload.eaccount?.split('@')[0],
          payload.subject,
          payload.body?.html || payload.body_text || payload.body || '',
          'New',
          'normal',
          new Date(payload.timestamp_email || Date.now()),
          false,
          JSON.stringify(payload)
        ]
      );
    }

    
    // Update health stats
    await db.query(
      `INSERT INTO instantly_webhook_health (org_id, webhook_url, total_received, total_processed, last_received_at)
       VALUES ($1, $2, 1, 1, now())
       ON CONFLICT (org_id) DO UPDATE SET
         total_received = instantly_webhook_health.total_received + 1,
         total_processed = instantly_webhook_health.total_processed + 1,
         last_received_at = now()`,
      [orgId, 'instantly-webhook'] // Simplified for now
    );
  }
}

module.exports = new InstantlyService();
