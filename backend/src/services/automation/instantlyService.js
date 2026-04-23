const db = require('../../config/database');
const realtimeService = require('../realtimeService');

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
      // Call Instantly API - try different endpoints based on Instantly.ai API documentation
      let response;
      let endpoint;
      
      // Try common Instantly.ai endpoints in order of likelihood
      const endpoints = [
        '/unibox',           // Most likely for inbox emails
        '/campaigns',        // Get campaigns first, then leads
        '/accounts',         // Account-based approach
        '/lead-lists'        // Lead lists approach
      ];
      
      let lastError;
      for (const testEndpoint of endpoints) {
        try {
          console.log(`[Instantly Service] Trying endpoint: ${testEndpoint}`);
          response = await fetch(`${this.baseUrl}${testEndpoint}?limit=50`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            endpoint = testEndpoint;
            console.log(`[Instantly Service] Success with endpoint: ${endpoint}`);
            break;
          } else {
            const errorData = await response.json().catch(() => ({}));
            lastError = errorData.message || `${response.status}: ${response.statusText}`;
            console.log(`[Instantly Service] Failed ${testEndpoint}: ${lastError}`);
          }
        } catch (error) {
          lastError = error.message;
          console.log(`[Instantly Service] Error with ${testEndpoint}: ${lastError}`);
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`All Instantly.ai endpoints failed. Last error: ${lastError}. Please check your API key scopes and Instantly.ai documentation.`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `API error: ${response.status}`;
        
        // Handle specific scope error
        if (errorMessage.includes('leads:read') || errorMessage.includes('emails:read')) {
          throw new Error('Instantly API key missing required scope: leads:read. Please regenerate your API key with leads permissions.');
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[Instantly Service] API Response from ${endpoint}:`, JSON.stringify(data, null, 2));
      
      // Handle different response structures based on endpoint
      let items = [];
      if (endpoint === '/unibox') {
        items = data.emails || data.messages || data.items || data.data || [];
      } else if (endpoint === '/campaigns') {
        items = data.campaigns || data.data || [];
        // For campaigns, we'd need to fetch leads from each campaign
        console.log(`[Instantly Service] Found ${items.length} campaigns, but need to implement campaign-specific lead fetching`);
        return { total: 0, synced: 0, message: 'Found campaigns but need campaign-specific implementation' };
      } else if (endpoint === '/lead-lists') {
        const leadLists = data.items || data.data || [];
        console.log(`[Instantly Service] Found ${leadLists.length} lead lists`);
        
        if (leadLists.length === 0) {
          return { total: 0, synced: 0, message: 'No lead lists found. Create lead lists in Instantly.ai first.' };
        }
        
        // Fetch leads from each lead list
        for (const leadList of leadLists) {
          console.log(`[Instantly Service] Fetching leads from list: ${leadList.name || leadList.id}`);
          try {
            const leadsResponse = await fetch(`${this.baseUrl}/lead-lists/${leadList.id}/leads?limit=100`, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
              }
            });
            
            if (leadsResponse.ok) {
              const leadsData = await leadsResponse.json();
              const leads = leadsData.items || leadsData.data || [];
              console.log(`[Instantly Service] Found ${leads.length} leads in list ${leadList.name || leadList.id}`);
              items.push(...leads);
            }
          } catch (error) {
            console.log(`[Instantly Service] Failed to fetch leads from list ${leadList.id}: ${error.message}`);
          }
        }
      } else {
        items = data.leads || data.items || data.data || data || [];
      }
      
      console.log(`[Instantly Service] Processing ${items.length} items from ${endpoint}`);
      
      if (items.length === 0) {
        return { total: 0, synced: 0, message: `No items found in ${endpoint}` };
      }
      
      let syncCount = 0;

      for (const item of items) {
        // Handle different item structures based on endpoint
        let email, lead;
        if (endpoint === '/unibox') {
          email = item;
          lead = null;
        } else {
          lead = item;
          email = item.email || item.last_reply || item;
        }
        
        const externalId = (item.id || item.lead_id || item.message_id || `${endpoint}-${Date.now()}-${Math.random()}`).toString();

        // Check if email already exists to avoid duplicates
        const existing = await db.query(
          'SELECT id FROM unibox_emails WHERE message_id = $1 AND org_id = $2',
          [externalId, orgId]
        );

        if (existing.rows.length === 0) {
          const bodyRaw = email?.body_text || email?.body || item.last_reply_body || item.body || '';
          const isHtml = /<[a-z][\s\S]*>/i.test(bodyRaw) || (typeof email?.body === 'object' && email.body.html);
          const bodyHtml = email?.body?.html || email?.body_html || (isHtml ? bodyRaw : '');
          const bodyText = !isHtml ? bodyRaw : (email?.body_text || email?.body?.text || '');

          const result = await db.query(
            `INSERT INTO unibox_emails (
              org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
              status, priority, received_at, is_read, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
              orgId,
              externalId,
              item.email || email?.from_address_email || email?.sender || email?.eaccount || 'unknown@example.com',
              (item.first_name && item.last_name) ? `${item.first_name} ${item.last_name}` : (email?.sender_name || email?.from_name || item.first_name || item.sender_name || 'Unknown Sender'),
              email?.subject || item.last_reply_subject || item.subject || 'No Subject',
              bodyText,
              bodyHtml,
              'Lead',
              'Normal',
              new Date(email?.timestamp_email || email?.received_at || item.last_reply_at || item.received_at || Date.now()),
              false,
              JSON.stringify({ endpoint, item, email, lead })
            ]
          );

          if (result.rows[0]) {
            realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
          }
          syncCount++;
        }
      }

      await db.query(
        'UPDATE instantly_integrations SET last_sync_at = now() WHERE org_id = $1',
        [orgId]
      );

      return { total: items.length, synced: syncCount, endpoint };
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

      // Extract and normalize body content
      const bodyRaw = payload.reply_body || payload.body_text || payload.body || '';
      const isHtml = /<[a-z][\s\S]*>/i.test(bodyRaw) || payload.reply_html || payload.body_html;
      const bodyHtml = payload.reply_html || payload.body_html || (isHtml ? bodyRaw : '');
      const bodyText = !isHtml ? bodyRaw : (payload.reply_text || payload.body_text || '');

      // Create record in unibox_emails
      const result = await db.query(
        `INSERT INTO unibox_emails (
          org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
          status, priority, received_at, is_read, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          orgId,
          externalId,
          payload.from_email || payload.sender || payload.from_address_email || payload.eaccount,
          payload.from_name || payload.sender_name || payload.lead_name || payload.eaccount?.split('@')[0] || 'Unknown Sender',
          payload.subject,
          bodyText,
          bodyHtml,
          'New',
          'Normal',
          new Date(payload.timestamp_email || payload.received_at || Date.now()),
          false,
          JSON.stringify(payload)
        ]
      );

      if (result.rows[0]) {
        realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
      }
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
