const db = require('../../config/database');
const realtimeService = require('../realtimeService');

// Designation signature parser from bottom of email body text
const extractDesignationFromEmail = (bodyText) => {
  if (!bodyText) return null;
  const lines = bodyText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const bottomLines = lines.slice(-15);
  const titlesPattern = /\b(Owner|Founder|CEO|Co-Founder|President|VP|Vice President|COO|CFO|CTO|Director|Partner|Principal|General Manager|Project Manager|PM|Estimator|Purchasing Agent|Purchasing Manager|Purchaser|Sales Manager|Account Executive|Estimating Manager|Chief Estimator|Estimating)\b/i;
  for (let i = bottomLines.length - 1; i >= 0; i--) {
    const line = bottomLines[i];
    if (line.length > 80) continue;
    const match = line.match(titlesPattern);
    if (match) {
      return line;
    }
  }
  return null;
};

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
  async saveSettings(orgId, { api_key, is_enabled, auto_add_leads = false }) {
    // In a real app, we'd encrypt the API key
    // For now, satisfy the requirement by storing it
    const query = `
      INSERT INTO instantly_integrations (org_id, api_key_encrypted, is_enabled, auto_add_leads, status, updated_at)
      VALUES ($1, $2, $3, $4, 'connected', now())
      ON CONFLICT (org_id) DO UPDATE SET
        api_key_encrypted = EXCLUDED.api_key_encrypted,
        is_enabled = EXCLUDED.is_enabled,
        auto_add_leads = EXCLUDED.auto_add_leads,
        status = 'connected',
        updated_at = now()
      RETURNING *
    `;
    const result = await db.query(query, [orgId, api_key, is_enabled, auto_add_leads]);
    return result.rows[0];
  }

  /**
   * Helper to ensure a lead exists in the leads table
   */
  async _ensureLeadExists(orgId, leadData) {
    try {
      const { email, first_name, last_name, company, phone, source = 'Instantly' } = leadData;
      
      // If we are missing critical info, try to enrich from Instantly API
      let enrichedFirstName = first_name;
      let enrichedLastName = last_name;
      let enrichedCompany = company;
      let enrichedPhone = phone;
      let enrichedWebsite = leadData.website || '';
      let enrichedAddress = leadData.location || '';
      let customFields = leadData.payload || {};

      if (!enrichedFirstName || !enrichedCompany || !enrichedPhone || !enrichedWebsite || !enrichedAddress) {
        try {
          const settings = await this.getSettings(orgId);
          if (settings && settings.api_key_encrypted) {
            const res = await fetch('https://api.instantly.ai/api/v2/leads/list', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${settings.api_key_encrypted}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ search: email, limit: 1 })
            });

            if (res.ok) {
              const resData = await res.json();
              if (resData.items && resData.items.length > 0) {
                const info = resData.items[0];
                console.log(`[Instantly Service] Enrichment found for ${email}:`, JSON.stringify({ company: info.company_name, phone: info.phone, website: info.website, payload_keys: Object.keys(info.payload || {}) }));
                enrichedFirstName = enrichedFirstName || info.first_name || info.firstName;
                enrichedLastName = enrichedLastName || info.last_name || info.lastName;
                enrichedCompany = enrichedCompany || info.company_name || info.companyName || info.company || info.payload?.companyName;
                enrichedPhone = enrichedPhone || info.phone || info.phoneNumber || info.payload?.phone || info.payload?.Myphone;
                enrichedWebsite = enrichedWebsite || info.website || info.payload?.website;
                enrichedAddress = enrichedAddress || info.payload?.location || info.payload?.Location;
                customFields = { ...customFields, ...(info.payload || {}) };
              }
            }
          }
        } catch (apiErr) {
          console.error('[Instantly Service] API Enrichment failed:', apiErr.message);
        }
      }

      // Remove standard mapped fields from custom fields so they don't pollute the custom_fields JSON
      const standardKeysToRemove = [
        'firstName', 'first_name', 'lastName', 'last_name', 'name', 
        'companyName', 'company_name', 'company', 
        'phone', 'Myphone', 'phoneNumber',
        'website', 'location', 'Location', 'address', 'email'
      ];
      standardKeysToRemove.forEach(k => delete customFields[k]);

      // Ensure "First Engagement" stage exists
      const stageKey = 'first_engagement';
      const stageCheck = await db.query(
        "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
        [orgId, stageKey]
      );
      if (stageCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
           VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
          [orgId, stageKey]
        );
      }

      // Designation signature parsing from email body text!
      const designation = extractDesignationFromEmail(leadData.body_text);

      // Created date should come from unibox email received_at date!
      const createdDate = leadData.received_at ? new Date(leadData.received_at) : new Date();

      // Additional notes with email subject, sender, date, body
      let interactionNotes = '';
      if (leadData.subject || leadData.body_text) {
        const bodyText = (leadData.body_text || "").trim();
        const firstPara = bodyText.split(/\n\s*\n/)[0].trim();
        interactionNotes = `Email Subject: ${leadData.subject || 'No Subject'}\n` +
          `From: ${enrichedFirstName || ''} ${enrichedLastName || ''} <${email}>\n` +
          `Date: ${createdDate.toLocaleString()}\n\n` +
          `Email Body:\n${firstPara}`;
      }

      // Check if lead exists
      const existing = await db.query(
        'SELECT id FROM leads WHERE email = $1 AND (org_id = $2 OR organization_id = $2)',
        [email, orgId]
      );

      const fullName = [enrichedFirstName, enrichedLastName].filter(Boolean).join(' ') || email.split('@')[0];

      // Clean reply prefixes (RE:, FW:, etc.) from lead title
      const cleanLeadTitle = (leadData.subject || 'Lead from Instantly')
        .replace(/^((re|fw|fwd)\s*:\s*)+/i, '')
        .trim();

      if (existing.rows.length === 0) {
        console.log(`[Instantly Service] Auto-adding new lead: ${email}`);
        await db.query(
          `INSERT INTO leads (
            org_id, organization_id, title, name, first_name, last_name, email, phone, company, company_name, 
            company_phone, company_email, designation, website, address, source, status, stage, 
            interaction_notes, description, custom_fields, created_at, updated_at
          ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $8, $7, $6, $9, $10, $11, $12, $13, $14, $15, $15, $16, $17, now())`,
          [
            orgId,
            cleanLeadTitle,
            fullName,
            enrichedFirstName || null,
            enrichedLastName || null,
            email,
            enrichedPhone || null,
            enrichedCompany || null,
            designation || null,
            enrichedWebsite || null,
            enrichedAddress || null,
            source,
            'Interested',
            stageKey,
            interactionNotes,
            JSON.stringify(customFields),
            createdDate
          ]
        );
      } else {
        // Update existing lead if info is missing, and merge custom_fields
        const existingLead = existing.rows[0];
        
        // Fetch existing custom fields to merge them
        const customFieldsCheck = await db.query('SELECT custom_fields FROM leads WHERE id = $1', [existingLead.id]);
        const existingCustomFields = customFieldsCheck.rows[0]?.custom_fields || {};
        const mergedCustomFields = { ...existingCustomFields, ...customFields };

        await db.query(
          `UPDATE leads SET 
            first_name = COALESCE(NULLIF(first_name, ''), $1),
            last_name = COALESCE(NULLIF(last_name, ''), $2),
            name = CASE WHEN (name IS NULL OR name = '' OR name = split_part(email, '@', 1)) AND ($1 IS NOT NULL) THEN (COALESCE($1, '') || ' ' || COALESCE($2, '')) ELSE name END,
            company = COALESCE(NULLIF(company, ''), $3),
            company_name = COALESCE(NULLIF(company_name, ''), $3),
            phone = COALESCE(NULLIF(phone, ''), $4),
            company_phone = COALESCE(NULLIF(company_phone, ''), $4),
            website = COALESCE(NULLIF(website, ''), $5),
            address = COALESCE(NULLIF(address, ''), $6),
            designation = COALESCE(NULLIF(designation, ''), $7),
            interaction_notes = COALESCE(NULLIF(interaction_notes, ''), $8),
            description = COALESCE(NULLIF(description, ''), $8),
            custom_fields = $9,
            updated_at = now()
           WHERE id = $10`,
          [
            enrichedFirstName || null,
            enrichedLastName || null,
            enrichedCompany || null,
            enrichedPhone || null,
            enrichedWebsite || null,
            enrichedAddress || null,
            designation || null,
            interactionNotes || null,
            JSON.stringify(mergedCustomFields),
            existingLead.id
          ]
        );
      }
    } catch (err) {
      console.error('[Instantly Service] Failed to auto-add lead:', err.message);
    }
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

    const apiKey = settings.api_key_encrypted;
    const MAX_ITEMS = 500;
    const autoAddLeads = settings.auto_add_leads === true;

    try {
      // Pre-fetch campaign names to resolve IDs to names automatically
      const campaignMap = new Map();
      try {
        console.log('[Instantly Service] Pre-fetching campaign names for resolution...');
        const campRes = await fetch(`${this.baseUrl}/campaigns`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
        });
        if (campRes.ok) {
          const apiData = await campRes.json();
          const items = apiData.items || [];
          items.forEach(c => {
            if (c.id && c.name) campaignMap.set(c.id, c.name);
          });
          console.log(`[Instantly Service] Pre-fetched ${campaignMap.size} campaigns from Instantly v2`);
        } else {
          // Try v1 fallback
          const campResV1 = await fetch(`https://api.instantly.ai/api/v1/campaign/list?api_key=${apiKey}`);
          if (campResV1.ok) {
            const apiDataV1 = await campResV1.json();
            if (Array.isArray(apiDataV1)) {
              apiDataV1.forEach(c => {
                if (c.id && c.name) campaignMap.set(c.id, c.name);
              });
              console.log(`[Instantly Service] Pre-fetched ${campaignMap.size} campaigns from Instantly v1 fallback`);
            }
          }
        }
      } catch (cErr) {
        console.error('[Instantly Service] Failed to pre-fetch campaigns list:', cErr.message);
      }

      // ── Try /emails API first (returns actual subject + body content) ──
      // Falls back to /leads/list if API key lacks emails:read scope
      let allItems = [];
      let useEmailsApi = true;
      let startingAfterId = null;
      let hasMore = true;

      // First, test if we have emails:read scope
      console.log('[Instantly Service] Testing /emails API access...');
      const testResponse = await fetch(`${this.baseUrl}/emails?limit=1&i_status=1`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
      });

      if (!testResponse.ok) {
        const testErr = await testResponse.json().catch(() => ({}));
        if (testErr.message && testErr.message.includes('scope')) {
          console.warn('[Instantly Service] ⚠️ API key lacks emails:read scope — falling back to /leads/list (no email content will be available)');
          console.warn('[Instantly Service] To get email subject & body, update your API key at app.instantly.ai → Settings → Integrations → API and add "emails:read" scope');
          useEmailsApi = false;
        } else {
          throw new Error(`Instantly API error: ${testErr.message || testResponse.status}`);
        }
      }

      if (useEmailsApi) {
        // ── EMAILS API: Returns subject, body.text, body.html ──
        console.log('[Instantly Service] ✅ Using /emails API (full content)');
        // Don't use test data, start fresh pagination
        startingAfterId = null;
        hasMore = true;

        while (hasMore && allItems.length < MAX_ITEMS) {
          const params = new URLSearchParams({
            limit: '100',
            i_status: '1',
            latest_of_thread: 'true',
            preview_only: 'false'
          });
          if (startingAfterId) params.set('starting_after', startingAfterId);

          const response = await fetch(`${this.baseUrl}/emails?${params.toString()}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Instantly /emails error: ${errorData.message || response.status}`);
          }

          const data = await response.json();
          const items = data.items || [];
          console.log(`[Instantly Service] Fetched ${items.length} emails (page ${Math.ceil(allItems.length / 100) + 1})`);
          allItems.push(...items);

          if (items.length < 100 || !data.next_starting_after) {
            hasMore = false;
          } else {
            startingAfterId = data.next_starting_after;
          }
        }
      } else {
        // ── LEADS API FALLBACK: Only returns metadata (name, email, company) — NO content ──
        console.log('[Instantly Service] Using /leads/list fallback (metadata only, no email content)');
        startingAfterId = null;
        hasMore = true;

        while (hasMore && allItems.length < MAX_ITEMS) {
          const requestBody = { limit: 100, interest_status: 1 };
          if (startingAfterId) requestBody.starting_after = startingAfterId;

          const response = await fetch(`${this.baseUrl}/leads/list`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Instantly /leads/list error: ${errorData.message || response.status}`);
          }

          const data = await response.json();
          const items = data.items || data.data || [];
          console.log(`[Instantly Service] Fetched ${items.length} leads (page ${Math.ceil(allItems.length / 100) + 1})`);
          allItems.push(...items);

          if (items.length < 100 || !data.next_starting_after) {
            hasMore = false;
          } else {
            startingAfterId = data.next_starting_after;
          }
        }
      }

      if (allItems.length > MAX_ITEMS) allItems = allItems.slice(0, MAX_ITEMS);
      console.log(`[Instantly Service] Total items to process: ${allItems.length} (via ${useEmailsApi ? '/emails' : '/leads/list'})`);

      if (allItems.length === 0) {
        return { total: 0, synced: 0, message: 'No interested leads/emails found in Instantly.' };
      }

      // Get existing records for dedup
      const existingResult = await db.query(
        'SELECT external_id, sender_email FROM unibox_emails WHERE org_id = $1',
        [orgId]
      );
      const existingExternalIds = new Set(existingResult.rows.map(r => r.external_id));
      const existingEmails = new Set(existingResult.rows.map(r => r.sender_email));

      let syncCount = 0;
      let skipCount = 0;
      let updateCount = 0;

      for (const item of allItems) {
        // ── Normalize fields based on which API was used ──
        let leadEmail, externalId, senderName, subject, bodyText, bodyHtml, receivedAt;
        let firstName, lastName, companyName, phoneNumber;

        if (useEmailsApi) {
          // /emails API fields
          leadEmail = item.lead || item.from_address_email || 'unknown@example.com';
          externalId = (item.id || `inst-${Date.now()}-${Math.random()}`).toString();
          senderName = item.from_address_email || leadEmail;
          subject = item.subject || '(No subject)';
          bodyText = (item.body && item.body.text) || item.content_preview || '';
          bodyHtml = (item.body && item.body.html) || '';
          receivedAt = new Date(item.timestamp_email || item.timestamp_created || Date.now());
          
          // Try to get lead details from item
          const leadObj = item.lead && typeof item.lead === 'object' ? item.lead : {};
          const payloadObj = leadObj.payload || item.payload || {};

          firstName = leadObj.first_name || item.lead_first_name || payloadObj.firstName || item.first_name;
          lastName = leadObj.last_name || item.lead_last_name || payloadObj.lastName || item.last_name;
          companyName = leadObj.company_name || item.lead_company_name || payloadObj.companyName || item.company_name || item.company;
          phoneNumber = leadObj.phone || item.lead_phone || payloadObj.phone || item.phone;

          // If still missing, try from_address_json (common in /emails API)
          if (!firstName && item.from_address_json && item.from_address_json.length > 0) {
            const name = item.from_address_json[0].name || '';
            if (name) {
              const parts = name.split(' ');
              firstName = parts[0];
              lastName = parts.slice(1).join(' ');
            }
          }
          if (!firstName && item.from_address_name) {
            const parts = item.from_address_name.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
        } else {
          // /leads/list API fields (NO email content available)
          leadEmail = item.email || item.lead_email || 'unknown@example.com';
          externalId = (item.id || item.lead_id || `inst-${Date.now()}-${Math.random()}`).toString();
          firstName = item.first_name;
          lastName = item.last_name;
          companyName = item.company_name;
          phoneNumber = item.phone;
          
          senderName = [firstName, lastName].filter(Boolean).join(' ') || item.lead_name || companyName || 'Unknown Sender';
          subject = `${senderName} — ${companyName || 'Interested Lead'}`;
          bodyText = [
            companyName ? `Company: ${companyName}` : '',
            phoneNumber ? `Phone: ${phoneNumber}` : '',
            item.website ? `Website: ${item.website}` : '',
            item.payload?.Rating ? `Rating: ${item.payload.Rating}` : '',
            item.payload?.Profile ? `Profile: ${item.payload.Profile}` : '',
            '',
            '⚠️ Full email content unavailable — update your Instantly API key to include "emails:read" scope.'
          ].filter(Boolean).join('\n');
          bodyHtml = '';
          receivedAt = new Date(item.timestamp_updated || item.timestamp_created || Date.now());
        }

        // Auto-add to leads table if enabled
        if (autoAddLeads) {
          // If we use the emails API, the item often lacks lead name/company. Fetch it!
          if (useEmailsApi && (!firstName || !companyName) && item.campaign_id) {
            try {
              // Try enrichment with campaign_id + email
              const enrichUrl = new URL('https://api.instantly.ai/api/v1/lead/get');
              enrichUrl.searchParams.set('campaign_id', item.campaign_id);
              enrichUrl.searchParams.set('email', leadEmail);
              const leadRes = await fetch(enrichUrl.toString(), {
                headers: { 'Authorization': `Bearer ${apiKey}` }
              });
              
              if (leadRes.ok) {
                const leadResData = await leadRes.json();
                const leadData = leadResData && (Array.isArray(leadResData) ? leadResData[0] : leadResData);
                
                if (leadData) {
                  firstName = leadData.first_name || leadData.firstName || firstName;
                  lastName = leadData.last_name || leadData.lastName || lastName;
                  companyName = leadData.company_name || leadData.company || companyName;
                  phoneNumber = leadData.phone || leadData.phone_number || phoneNumber;
                }
              }
            } catch (err) {
              // Silent fail for enrichment, we already have the email
            }
          }

          await this._ensureLeadExists(orgId, {
            email: leadEmail,
            first_name: firstName,
            last_name: lastName,
            company: companyName,
            phone: phoneNumber,
            website: item.website || (item.lead && item.lead.website) || (item.payload && (item.payload.website || item.payload.Website)) || null,
            location: item.location || (item.lead && item.lead.location) || (item.payload && (item.payload.location || item.payload.Location || item.payload.address || item.payload.Address)) || null,
            payload: (item.lead && item.lead.payload) || item.payload || {},
            subject: subject,
            body_text: bodyText,
            received_at: receivedAt
          });
        }

        // Resolve campaign metadata
        const campaignId = item.campaign_id || (item.lead && item.lead.campaign_id);
        const campaignName = campaignId ? campaignMap.get(campaignId) : null;
        
        const metaUpdate = {
          campaign_id: campaignId || null,
          campaign_name: campaignName || null
        };

        const metaNew = {
          source: useEmailsApi ? 'emails_api' : 'leads_api',
          campaign_id: campaignId || null,
          campaign_name: campaignName || null,
          item
        };

        // Dedup + backfill logic
        if (existingExternalIds.has(externalId)) {
          if (useEmailsApi && subject && bodyText) {
            try {
              await db.query(
                `UPDATE unibox_emails 
                 SET subject = CASE WHEN subject IS NULL OR subject = '' OR subject LIKE 'Lead:%' THEN $1 ELSE subject END,
                     body_text = CASE WHEN body_text IS NULL OR body_text = '' THEN $2 ELSE body_text END,
                     body_html = CASE WHEN body_html IS NULL OR body_html = '' THEN $3 ELSE body_html END,
                     metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                     updated_at = NOW()
                 WHERE external_id = $4 AND org_id = $6`,
                [subject, bodyText, bodyHtml, externalId, JSON.stringify(metaUpdate), orgId]
              );
              updateCount++;
            } catch (err) { /* silent */ }
          }
          skipCount++;
          continue;
        }

        if (existingEmails.has(leadEmail)) {
          if (useEmailsApi && subject && bodyText) {
            try {
              const updateResult = await db.query(
                `UPDATE unibox_emails 
                 SET subject = CASE WHEN subject IS NULL OR subject = '' OR subject LIKE 'Lead:%' THEN $1 ELSE subject END,
                     body_text = CASE WHEN body_text IS NULL OR body_text = '' THEN $2 ELSE body_text END,
                     body_html = CASE WHEN body_html IS NULL OR body_html = '' THEN $3 ELSE body_html END,
                     external_id = COALESCE(NULLIF(external_id, ''), $4),
                     metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
                     updated_at = NOW()
                 WHERE sender_email = $6 AND org_id = $7`,
                [subject, bodyText, bodyHtml, externalId, JSON.stringify(metaUpdate), leadEmail, orgId]
              );
              if (updateResult.rowCount > 0) updateCount++;
            } catch (err) { /* silent */ }
          }
          skipCount++;
          continue;
        }

        // Insert new record
        try {
          await db.query(
            `INSERT INTO unibox_emails (
              org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
              status, priority, received_at, is_read, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              orgId, externalId, leadEmail, senderName, subject, bodyText, bodyHtml,
              'Interested', 'Normal', receivedAt,
              useEmailsApi ? (item.is_unread === 1) : false,
              JSON.stringify(metaNew)
            ]
          );
          existingExternalIds.add(externalId);
          existingEmails.add(leadEmail);
          syncCount++;

          if (syncCount % 50 === 0) {
            console.log(`[Instantly Service] Progress: ${syncCount} synced, ${updateCount} backfilled, ${skipCount} skipped`);
          }
        } catch (insertErr) {
          if (insertErr.code !== '23505') {
            console.error(`[Instantly Service] Insert failed for ${leadEmail}:`, insertErr.message);
          }
        }
      }

      await db.query(
        'UPDATE instantly_integrations SET last_sync_at = now() WHERE org_id = $1',
        [orgId]
      );

      let message = `Synced ${syncCount} new, backfilled ${updateCount}, skipped ${skipCount}.`;
      if (!useEmailsApi) {
        message += ' ⚠️ Email content unavailable — add "emails:read" scope to your Instantly API key for full subject & body.';
      }
      console.log(`[Instantly Service] ✅ ${message}`);
      return { total: allItems.length, synced: syncCount, updated: updateCount, skipped: skipCount, message, api_used: useEmailsApi ? 'emails' : 'leads_fallback' };
    } catch (error) {
      console.error('[Instantly Service] Sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Process incoming webhook event from Instantly.ai
   */
  async handleWebhook(orgId, payload) {
    console.log(`[Instantly Webhook] Raw payload:`, JSON.stringify(payload, null, 2));

    const eventType = payload.event_type || 'unknown';

    // Log the event for audit trail
    await db.query(
      `INSERT INTO instantly_unibox_events (
        org_id, event_type, payload, sender_email, sender_name, subject, body_text, processed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [
        orgId,
        eventType,
        JSON.stringify(payload),
        payload.lead_email || payload.email_account || null,
        payload.lead_name || null,
        payload.campaign_name || payload.subject || null,
        payload.body_text || payload.body || null
      ]
    );

    // Only process events where the lead is marked as interested
    const isInterested = eventType === 'lead_interested';
    const isStatusChange = eventType === 'lead_status_changed';
    const isMarked = eventType === 'lead_marked';

    let processedAsInterested = false;

    if (isInterested) {
      processedAsInterested = true;
      console.log(`[Instantly Webhook] ✅ Lead interested event received for: ${payload.lead_email}`);
    } else if (isStatusChange || isMarked) {
      const newStatus = (payload.new_status || payload.lead_status || payload.status || payload.mark || '').toLowerCase();
      if (newStatus === 'interested') {
        processedAsInterested = true;
        console.log(`[Instantly Webhook] ✅ Status change to interested for: ${payload.lead_email || payload.email}`);
      }
    }

    if (!processedAsInterested) {
      console.log(`[Instantly Webhook] Ignoring event type: ${eventType}`);
      await this._updateWebhookHealth(orgId, false);
      return;
    }

    // Extract lead details
    const leadEmail = payload.lead_email || payload.email || payload.from_email || payload.sender;
    if (!leadEmail) {
      console.error('[Instantly Webhook] No lead email found in payload — cannot process');
      await this._updateWebhookHealth(orgId, false);
      return;
    }

    // Auto-add to leads table if enabled
    const settings = await this.getSettings(orgId);
    if (settings && settings.auto_add_leads) {
      // Robustly extract lead details from webhook payload (matching fix_leads.js logic)
      const leadObj = payload.lead && typeof payload.lead === 'object' ? payload.lead : {};
      const payloadObj = leadObj.payload || payload.payload || {};

      const fName = payload.lead_first_name || payload.first_name || leadObj.first_name || payloadObj.firstName;
      const lName = payload.lead_last_name || payload.last_name || leadObj.last_name || payloadObj.lastName;
      const comp = payload.company_name || payload.lead_company_name || payload.company || leadObj.company_name || payloadObj.companyName;
      const ph = payload.phone || payload.lead_phone || leadObj.phone || payloadObj.phone;

      await this._ensureLeadExists(orgId, {
        email: leadEmail,
        first_name: fName,
        last_name: lName,
        company: comp,
        phone: ph,
        website: leadObj.website || payloadObj.website || null,
        location: leadObj.location || payloadObj.location || payloadObj.Location || payloadObj.address || payloadObj.Address || null,
        payload: payloadObj,
        subject: payload.subject || `Webhook Event: ${eventType}`,
        body_text: payload.reply_body || payload.body_text || payload.body || '',
        received_at: new Date(payload.timestamp || Date.now())
      });
    }

    const externalId = (payload.id || payload.lead_id || `inst-wh-${Date.now()}`).toString();

    // Check if we already have this lead in unibox
    const existing = await db.query(
      'SELECT id FROM unibox_emails WHERE (external_id = $1 OR sender_email = $2) AND org_id = $3',
      [externalId, leadEmail, orgId]
    );

    if (existing.rows.length > 0) {
      // Update existing record to 'Interested'
      await db.query(
        "UPDATE unibox_emails SET status = 'Interested', updated_at = now() WHERE id = $1",
        [existing.rows[0].id]
      );
      console.log(`[Instantly Webhook] Updated existing lead to Interested: ${leadEmail}`);
    } else {
      // Create new record in unibox_emails
      const senderName = payload.lead_name || payload.from_name || leadEmail.split('@')[0] || 'Unknown Sender';
      const bodyRaw = payload.reply_body || payload.body_text || payload.body || '';
      const isHtml = /<[a-z][\s\S]*>/i.test(bodyRaw);
      const bodyHtml = payload.reply_html || payload.body_html || (isHtml ? bodyRaw : '');
      const bodyText = !isHtml ? bodyRaw : (payload.reply_text || payload.body_text || '');

      const result = await db.query(
        `INSERT INTO unibox_emails (
          org_id, external_id, sender_email, sender_name, subject, body_text, body_html,
          status, priority, received_at, is_read, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          orgId,
          externalId,
          leadEmail,
          senderName,
          payload.subject || `Interested lead from ${payload.campaign_name || 'campaign'}`,
          bodyText,
          bodyHtml,
          'Interested',
          'Normal',
          new Date(payload.timestamp || Date.now()),
          false,
          JSON.stringify(payload)
        ]
      );

      if (result.rows[0]) {
        realtimeService.emitUniboxEmailCreated(orgId, result.rows[0]);
        console.log(`[Instantly Webhook] ✅ Created new Interested lead: ${leadEmail}`);
      }
    }

    // Update health stats
    await this._updateWebhookHealth(orgId, true);
  }

  /**
   * Update webhook health tracking
   */
  async _updateWebhookHealth(orgId, processed) {
    const processedIncrement = processed ? 1 : 0;
    await db.query(
      `INSERT INTO instantly_webhook_health (org_id, webhook_url, total_received, total_processed, last_received_at)
       VALUES ($1, $2, 1, $3, now())
       ON CONFLICT (org_id) DO UPDATE SET
         total_received = instantly_webhook_health.total_received + 1,
         total_processed = instantly_webhook_health.total_processed + ${processedIncrement},
         last_received_at = now()`,
      [orgId, 'instantly-webhook', processedIncrement]
    );
  }
}

module.exports = new InstantlyService();
