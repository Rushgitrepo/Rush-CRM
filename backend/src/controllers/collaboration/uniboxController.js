const db = require('../../config/database');

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

// Get unibox emails with enhanced features
const getEmails = async (req, res, next) => {
  try {
    const {
      status = 'All',
      limit = 50,
      offset = 0,
      search = '',
      starred = false,
      unread = false,
      priority = 'all',
      campaign_id = ''
    } = req.query;

    const params = [req.user.orgId];
    let paramIndex = 2;
    let whereClause = 'WHERE org_id = $1 AND is_archived = false';

    // Status filter
    if (status && status !== 'All') {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Search filter
    if (search) {
      whereClause += ` AND (
        sender_email ILIKE $${paramIndex} OR 
        sender_name ILIKE $${paramIndex} OR 
        subject ILIKE $${paramIndex} OR 
        body_text ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Starred filter
    if (starred === 'true') {
      whereClause += ` AND is_starred = true`;
    }

    // Unread filter
    if (unread === 'true') {
      whereClause += ` AND is_read = false`;
    }

    // Priority filter
    if (priority && priority !== 'all') {
      whereClause += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    // Campaign filter
    if (campaign_id === 'none') {
      whereClause += ` AND (
        metadata IS NULL OR
        (
          (metadata->'item'->>'campaign_id') IS NULL AND
          (metadata->>'campaign_id') IS NULL
        )
      )`;
    } else if (campaign_id) {
      whereClause += ` AND (
        (metadata->'item'->>'campaign_id' = $${paramIndex}) OR
        (metadata->>'campaign_id' = $${paramIndex})
      )`;
      params.push(campaign_id);
      paramIndex++;
    }

    const limitParam = `$${paramIndex++}`;
    const offsetParam = `$${paramIndex++}`;
    params.push(limit, offset);

    const query = `
      SELECT 
        id,
        org_id,
        external_id,
        sender_email,
        sender_name,
        subject,
        body_text,
        body_html,
        body,
        status,
        priority,
        tags,
        attachments,
        is_read,
        is_starred,
        is_archived,
        converted_to_lead_id,
        received_at,
        created_at,
        updated_at,
        metadata
      FROM unibox_emails
      ${whereClause}
      ORDER BY 
        CASE WHEN is_starred THEN 0 ELSE 1 END,
        CASE WHEN is_read THEN 1 ELSE 0 END,
        received_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await db.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM unibox_emails
      ${whereClause.replace(/LIMIT.*$/, '')}
    `;
    const countResult = await db.query(countQuery, params.slice(0, -2));

    res.json({
      emails: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(countResult.rows[0].total / limit)
    });
  } catch (err) {
    next(err);
  }
};


// Get a single email by ID
const getEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;
    const result = await db.query(
      'SELECT * FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json({ email: result.rows[0] });
  } catch (err) {
    next(err);
  }
};


// Update email status
const updateEmailStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, interaction_notes, priority, tags } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const fields = ['status = $1', 'updated_at = now()'];
    const values = [status];
    let paramIndex = 2;

    if (priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }

    if (tags !== undefined) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE unibox_emails SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Toggle email starred status
const toggleStarred = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_starred } = req.body;

    const result = await db.query(
      `UPDATE unibox_emails SET is_starred = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3 RETURNING *`,
      [is_starred, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Mark email as read/unread
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_read } = req.body;

    const result = await db.query(
      `UPDATE unibox_emails SET is_read = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3 RETURNING *`,
      [is_read, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Archive/unarchive email
const toggleArchive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_archived } = req.body;

    const result = await db.query(
      `UPDATE unibox_emails SET is_archived = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3 RETURNING *`,
      [is_archived, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get email statistics
const getStats = async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE is_starred = true) as starred,
        COUNT(*) FILTER (WHERE status = 'Lead') as leads,
        COUNT(*) FILTER (WHERE status = 'Interested') as interested,
        COUNT(*) FILTER (WHERE status = 'Meeting Booked') as meetings,
        COUNT(*) FILTER (WHERE status = 'Converted') as converted,
        COUNT(*) FILTER (WHERE converted_to_lead_id IS NOT NULL) as converted_to_leads
      FROM unibox_emails 
      WHERE org_id = $1 AND is_archived = false
    `;

    const result = await db.query(statsQuery, [req.user.orgId]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get email templates
const getTemplates = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM unibox_templates 
       WHERE org_id = $1 AND is_active = true 
       ORDER BY created_at DESC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Convert email to lead
const convertToLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, company_name, company_email, company_phone, website, address, interaction_notes } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Lead title is required' });
    }

    // Fetch email details first to get sender information, metadata and received_at date
    const emailResult = await db.query(
      'SELECT * FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    const email = emailResult.rows[0];

    // Parse existing metadata
    const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
    const item = metadata.item || {};
    const payload = item.payload || metadata.payload || {};

    // Get Instantly integration settings to do a real-time enrichment if API key is present
    let enrichedFirstName = item.first_name || '';
    let enrichedLastName = item.last_name || '';
    let enrichedCompany = company_name || item.company_name || payload.companyName || '';
    let enrichedPhone = company_phone || item.phone || payload.phone || payload.Myphone || '';
    let enrichedWebsite = website || item.website || payload.website || '';
    let enrichedAddress = address || payload.location || payload.Location || '';
    let mergedPayload = { ...payload };

    const integrationResult = await db.query(
      'SELECT api_key_encrypted FROM instantly_integrations WHERE org_id = $1',
      [req.user.orgId]
    );
    const settings = integrationResult.rows[0];
    const apiKey = settings?.api_key_encrypted || process.env.INSTANTLY_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch('https://api.instantly.ai/api/v2/leads/list', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            search: email.sender_email,
            limit: 1
          })
        });

        if (response.ok) {
          const apiData = await response.json();
          if (apiData.items && apiData.items.length > 0) {
            const instLead = apiData.items[0];
            enrichedFirstName = instLead.first_name || enrichedFirstName;
            enrichedLastName = instLead.last_name || enrichedLastName;
            enrichedCompany = enrichedCompany || instLead.company_name || instLead.payload?.companyName;
            enrichedPhone = enrichedPhone || instLead.phone || instLead.payload?.phone || instLead.payload?.Myphone;
            enrichedWebsite = enrichedWebsite || instLead.website || instLead.payload?.website;
            enrichedAddress = enrichedAddress || instLead.payload?.location || instLead.payload?.Location;
            mergedPayload = { ...mergedPayload, ...(instLead.payload || {}) };
          }
        }
      } catch (apiErr) {
        console.error('[Unibox Controller] Real-time lookup during convert failed:', apiErr.message);
      }
    }

    // Remove standard mapped fields from custom fields so they don't pollute the custom_fields JSON
    const standardKeysToRemove = [
      'firstName', 'first_name', 'lastName', 'last_name', 'name',
      'companyName', 'company_name', 'company',
      'phone', 'Myphone', 'phoneNumber',
      'website', 'location', 'Location', 'address', 'email'
    ];
    standardKeysToRemove.forEach(k => delete mergedPayload[k]);

    // Split and assemble names
    const fullName = [enrichedFirstName, enrichedLastName].filter(Boolean).join(' ') || email.sender_name || 'Prospect';

    // Designation signature parsing from email body text!
    const designation = extractDesignationFromEmail(email.body_text);

    // Created date should come from unibox email received_at date!
    const createdDate = email.received_at ? new Date(email.received_at) : new Date();

    // Use the carefully curated interaction notes from the frontend!
    // Fallback to first paragraph of body if empty.
    let formattedNotes = interaction_notes || '';
    if (!formattedNotes) {
      const bodyText = (email.body_text || "").trim();
      const firstPara = bodyText.split(/\n\s*\n/)[0].trim();
      formattedNotes = `Email Subject: ${email.subject || 'No Subject'}\n` +
        `From: ${email.sender_name || 'Unknown'} <${email.sender_email}>\n` +
        `Date: ${createdDate.toLocaleString()}\n\n` +
        `Email Body:\n${firstPara}`;
    }

    // Ensure first_engagement stage exists
    const stageKey = 'first_engagement';
    const stageCheck = await db.query(
      "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
      [req.user.orgId, stageKey]
    );
    if (stageCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
         VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
        [req.user.orgId, stageKey]
      );
    }

    // Clean reply prefixes (RE:, FW:, etc.) from lead title
    const cleanLeadTitle = (title || email.subject || 'Lead from Unibox')
      .replace(/^((re|fw|fwd)\s*:\s*)+/i, '')
      .trim();

    // Create the lead with every single field mapped!
    const leadResult = await db.query(
      `INSERT INTO leads (
        org_id, title, name, first_name, last_name, email, phone, company, company_name, 
        company_phone, company_email, designation, website, address, source, status, stage, 
        interaction_notes, description, custom_fields, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $7, $6, $9, $10, $11, $12, $13, $14, $15, $15, $16, $17, $18, NOW()) 
      RETURNING *`,
      [
        req.user.orgId,
        cleanLeadTitle,
        fullName,
        enrichedFirstName || null,
        enrichedLastName || null,
        email.sender_email,
        enrichedPhone || null,
        enrichedCompany || null,
        designation || null,
        enrichedWebsite || null,
        enrichedAddress || null,
        'Instantly',
        'Interested',
        stageKey,
        formattedNotes,
        JSON.stringify(mergedPayload),
        req.user.id,
        createdDate
      ]
    );

    const lead = leadResult.rows[0];

    // Update the unibox email to mark it as converted
    await db.query(
      `UPDATE unibox_emails SET status = 'Converted', converted_to_lead_id = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3`,
      [lead.id, id, req.user.orgId]
    );

    res.json({
      message: 'Email converted to lead successfully',
      lead: lead
    });
  } catch (err) {
    next(err);
  }
};

// Check user permission for unibox
const checkPermission = async (req, res, next) => {
  try {
    console.log('Unibox permission check for user:', req.user.id, req.user.email, req.user.role);

    // Check if user is super admin
    const userResult = await db.query(
      'SELECT role, has_unibox_access FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    console.log('Database result:', userResult.rows);

    if (userResult.rows.length === 0) {
      console.log('No user found in database');
      return res.json({ hasPermission: false, isOwner: false });
    }

    const user = userResult.rows[0];
    const isSuperAdmin = user.role === 'super_admin';
    const hasAccess = isSuperAdmin || user.has_unibox_access || false;

    console.log('Permission check result:', { isSuperAdmin, hasAccess, role: user.role, has_unibox_access: user.has_unibox_access });

    const result = {
      hasPermission: hasAccess,
      isOwner: isSuperAdmin
    };

    console.log('Sending response:', result);
    res.json(result);
  } catch (err) {
    console.error('Unibox permission check error:', err);
    next(err);
  }
};

// Get all users with unibox permission (super admin only)
const getPermissions = async (req, res, next) => {
  try {
    // Check if user is super admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can view permissions' });
    }

    const result = await db.query(
      `SELECT 
        id,
        full_name,
        email,
        avatar_url,
        role,
        updated_at as granted_at
      FROM users
      WHERE org_id = $1 AND has_unibox_access = TRUE
      ORDER BY full_name ASC`,
      [req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Grant unibox permission to a user (super admin only)
const grantPermission = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    // Check if user is super admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can grant permissions' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if user exists in the same org
    const userCheck = await db.query(
      'SELECT id, full_name FROM users WHERE id = $1 AND org_id = $2',
      [user_id, req.user.orgId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    // Grant permission
    await db.query(
      'UPDATE users SET has_unibox_access = TRUE WHERE id = $1 AND org_id = $2',
      [user_id, req.user.orgId]
    );

    res.json({
      message: `Unibox access granted to ${userCheck.rows[0].full_name}`
    });
  } catch (err) {
    next(err);
  }
};

// Revoke unibox permission from a user (super admin only)
const revokePermission = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    // Check if user is super admin
    const adminCheck = await db.query(
      'SELECT role FROM users WHERE id = $1 AND org_id = $2',
      [req.user.id, req.user.orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can revoke permissions' });
    }

    const result = await db.query(
      'UPDATE users SET has_unibox_access = FALSE WHERE id = $1 AND org_id = $2 RETURNING full_name',
      [user_id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Unibox access revoked successfully' });
  } catch (err) {
    next(err);
  }
};

// Create sample unibox email (for testing)
const createSampleEmail = async (req, res, next) => {
  try {
    const { sender_email, sender_name, subject, body_text, status, priority } = req.body;

    const result = await db.query(
      `INSERT INTO unibox_emails (
        org_id, external_id, sender_email, sender_name, subject, body_text, 
        status, priority, received_at, is_read, is_starred
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.user.orgId,
        `sample-${Date.now()}`,
        sender_email || 'test@example.com',
        sender_name || 'Test User',
        subject || 'Test Email',
        body_text || 'This is a test email from Instantly.ai',
        status || 'Lead',
        priority || 'normal',
        new Date(),
        false,
        false
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Get combined lead and instantly metadata for an email
const getEmailLeadInfo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const emailResult = await db.query(
      'SELECT * FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    const email = emailResult.rows[0];
    let lead = null;

    if (email.converted_to_lead_id) {
      const leadResult = await db.query(
        `SELECT l.*,
                c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone, 
                co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone
         FROM public.leads l
         LEFT JOIN public.contacts c ON c.id = l.contact_id
         LEFT JOIN public.companies co ON co.id = l.company_id
         WHERE l.id = $1 AND l.org_id = $2`,
        [email.converted_to_lead_id, req.user.orgId]
      );
      if (leadResult.rows.length > 0) {
        lead = leadResult.rows[0];
      }
    }

    if (!lead) {
      const leadResult = await db.query(
        `SELECT l.*,
                c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email, c.phone as contact_phone, 
                co.name as linked_company_name, co.email as linked_company_email, co.phone as linked_company_phone
         FROM public.leads l
         LEFT JOIN public.contacts c ON c.id = l.contact_id
         LEFT JOIN public.companies co ON co.id = l.company_id
         WHERE (l.email = $1 OR c.email = $1) AND l.org_id = $2
         ORDER BY l.created_at DESC LIMIT 1`,
        [email.sender_email, req.user.orgId]
      );
      if (leadResult.rows.length > 0) {
        lead = leadResult.rows[0];
      }
    }

    // Safely extract metadata from Instantly payload
    const metadata = typeof email.metadata === 'string' ? JSON.parse(email.metadata) : (email.metadata || {});
    const item = metadata.item || {};
    const payload = item.payload || metadata.payload || {};

    // Real-time enrichment from Instantly V2 API
    let updatedMetadata = metadata;
    let updatedItem = item;
    let updatedPayload = payload;

    const integrationResult = await db.query(
      'SELECT api_key_encrypted FROM instantly_integrations WHERE org_id = $1',
      [req.user.orgId]
    );
    const settings = integrationResult.rows[0];
    const apiKey = settings?.api_key_encrypted || process.env.INSTANTLY_API_KEY;

    if (apiKey) {
      try {
        const response = await fetch('https://api.instantly.ai/api/v2/leads/list', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            search: email.sender_email,
            limit: 1
          })
        });

        if (response.ok) {
          const apiData = await response.json();
          if (apiData.items && apiData.items.length > 0) {
            const instLead = apiData.items[0];

            // Found the real Instantly lead! Update metadata cache in DB
            updatedItem = { ...updatedItem, ...instLead };
            updatedPayload = { ...updatedPayload, ...(instLead.payload || {}) };
            updatedMetadata = { ...updatedMetadata, item: updatedItem };

            await db.query(
              'UPDATE unibox_emails SET metadata = $1, updated_at = NOW() WHERE id = $2',
              [JSON.stringify(updatedMetadata), email.id]
            );

            // Also backfill the matched lead in our leads table!
            if (lead) {
              const enrichedPhone = lead.phone || instLead.phone || updatedPayload.phone || updatedPayload.Myphone || null;
              const enrichedCompany = lead.company_name || lead.company || instLead.company_name || updatedPayload.companyName || null;
              const enrichedWebsite = lead.website || instLead.website || updatedPayload.website || null;
              const enrichedAddress = lead.address || updatedPayload.location || null;
              const enrichedFirstName = lead.first_name || instLead.first_name || null;
              const enrichedLastName = lead.last_name || instLead.last_name || null;

              // Merge custom variables into the lead's custom_fields JSONB column
              const currentCustomFields = typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields) : (lead.custom_fields || {});
              const mergedCustomFields = { ...currentCustomFields, ...updatedPayload };

              // Remove standard mapped fields from custom fields so they don't pollute the custom_fields JSON
              const standardKeysToRemove = [
                'firstName', 'first_name', 'lastName', 'last_name', 'name',
                'companyName', 'company_name', 'company',
                'phone', 'Myphone', 'phoneNumber',
                'website', 'location', 'Location', 'address', 'email'
              ];
              standardKeysToRemove.forEach(k => delete mergedCustomFields[k]);

              await db.query(
                `UPDATE leads SET 
                  phone = COALESCE(NULLIF(phone, ''), $1),
                  company = COALESCE(NULLIF(company, ''), $2),
                  company_name = COALESCE(NULLIF(company_name, ''), $2),
                  website = COALESCE(NULLIF(website, ''), $3),
                  address = COALESCE(NULLIF(address, ''), $4),
                  first_name = COALESCE(NULLIF(first_name, ''), $5),
                  last_name = COALESCE(NULLIF(last_name, ''), $6),
                  custom_fields = $7,
                  updated_at = NOW()
                 WHERE id = $8`,
                [enrichedPhone, enrichedCompany, enrichedWebsite, enrichedAddress, enrichedFirstName, enrichedLastName, JSON.stringify(mergedCustomFields), lead.id]
              );

              // Update our local lead object to match the newly enriched data in the response
              lead.phone = enrichedPhone;
              lead.company_name = enrichedCompany;
              lead.company = enrichedCompany;
              lead.website = enrichedWebsite;
              lead.address = enrichedAddress;
              lead.first_name = enrichedFirstName;
              lead.last_name = enrichedLastName;
              lead.custom_fields = mergedCustomFields;
            }
          }
        }
      } catch (apiErr) {
        console.error('[Unibox Controller] Real-time Instantly lookup failed:', apiErr.message);
      }
    }

    const extracted = {
      campaign: updatedMetadata.campaign_name || updatedItem.campaign_name || updatedMetadata.campaign || updatedItem.campaign_id || '',
      campaign_id: updatedItem.campaign_id || (typeof updatedMetadata.campaign === 'string' && updatedMetadata.campaign.length > 20 ? updatedMetadata.campaign : '') || '',
      rating: updatedPayload.Rating || updatedPayload.rating || '',
      profile: updatedPayload.Profile || updatedPayload.profile || '',
      facebook: updatedPayload.Facebook || updatedPayload.facebook || '',
      location: updatedPayload.location || updatedPayload.Location || lead?.address || '',
      website: lead?.website || updatedItem.website || updatedMetadata.website || updatedPayload.website || '',
      phone: lead?.phone || updatedItem.phone || updatedMetadata.phone || updatedPayload.phone || '',
      companyName: lead?.company_name || lead?.company || updatedItem.company_name || updatedItem.company || updatedMetadata.company || '',
      payload: updatedPayload
    };
    // Resolve campaign ID to name
    if (extracted.campaign && extracted.campaign.includes('-') && apiKey) {
      try {
        const campRes = await fetch(`https://api.instantly.ai/api/v2/campaigns/${extracted.campaign}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (campRes.ok) {
          const campData = await campRes.json();
          if (campData.name) extracted.campaign = campData.name;
        }
      } catch { }
    }

    res.json({
      lead: lead ? {
        id: lead.id,
        title: lead.title,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company_name || lead.company,
        website: lead.website,
        address: lead.address,
        source: lead.source,
        stage: lead.stage,
        custom_fields: typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields) : (lead.custom_fields || {}),
        createdAt: lead.created_at
      } : null,
      instantly: extracted
    });
  } catch (err) {
    next(err);
  }
};

// Get distinct campaigns from local emails metadata & fetch fresh ones from Instantly API
const getCampaigns = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    // 1. Get campaign email counts from local unibox_emails
    const countsResult = await db.query(
      `SELECT 
         COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id') AS campaign_id,
         COUNT(*) as email_count
       FROM unibox_emails
       WHERE org_id = $1 AND is_archived = false
       GROUP BY campaign_id`,
      [orgId]
    );

    const countMap = new Map();
    countsResult.rows.forEach(row => {
      countMap.set(row.campaign_id || 'none', parseInt(row.email_count));
    });

    // 2. Query distinct campaign metadata we already have locally
    const dbCampaignsResult = await db.query(
      `SELECT DISTINCT 
         COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id') AS campaign_id,
         COALESCE(metadata->'item'->>'campaign_name', metadata->>'campaign_name') AS campaign_name
       FROM unibox_emails
       WHERE org_id = $1 AND (
         (metadata->'item'->>'campaign_id') IS NOT NULL OR
         (metadata->>'campaign_id') IS NOT NULL
       )`,
      [orgId]
    );

    const campaignMap = new Map();
    dbCampaignsResult.rows.forEach(row => {
      if (row.campaign_id) {
        campaignMap.set(row.campaign_id, {
          id: row.campaign_id,
          name: row.campaign_name || `Campaign (${row.campaign_id.substring(0, 8)})`,
          status: 'unknown',
          source: 'local'
        });
      }
    });

    // 3. Retrieve campaigns list from Instantly API to supplement details
    const integrationResult = await db.query(
      'SELECT api_key_encrypted, is_enabled FROM instantly_integrations WHERE org_id = $1',
      [orgId]
    );
    const settings = integrationResult.rows[0];
    const apiKey = settings?.api_key_encrypted || process.env.INSTANTLY_API_KEY;

    if (settings?.is_enabled !== false && apiKey) {
      try {
        // Try Instantly API v2 campaigns list
        let hasMore = true;
        let startingAfter = null;
        let v2Success = false;

        while (hasMore) {
          const params = new URLSearchParams({ limit: '100' });
          if (startingAfter) params.set('starting_after', startingAfter);

          const response = await fetch(`https://api.instantly.ai/api/v2/campaigns?${params}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });

          if (!response.ok) break;



          v2Success = true;
          const apiData = await response.json();
          const items = apiData.items || [];

          items.forEach(c => {
            campaignMap.set(c.id, {
              id: c.id,
              name: c.name,
              status: c.status === 1 ? 'active' : 'paused',
              source: 'instantly_v2'
            });
          });

          if (items.length < 100 || !apiData.next_starting_after) {
            hasMore = false;
          } else {
            startingAfter = apiData.next_starting_after;
          }
        }

        if (!v2Success) {
          // Fallback to Instantly API v1
          const responseV1 = await fetch(`https://api.instantly.ai/api/v1/campaign/list?api_key=${apiKey}`);
          if (responseV1.ok) {
            const apiDataV1 = await responseV1.json();
            if (Array.isArray(apiDataV1)) {
              apiDataV1.forEach(c => {
                campaignMap.set(c.id, {
                  id: c.id,
                  name: c.name,
                  status: 'active',
                  source: 'instantly_v1'
                });
              });
            }
          }
        }

      } catch (apiErr) {
        console.error('[Unibox Controller] Failed to fetch campaigns from Instantly:', apiErr.message);
      }
    }

    // Combine everything with count
    const campaigns = Array.from(campaignMap.values()).map(c => ({
      ...c,
      email_count: countMap.get(c.id) || 0
    }));

    // Add a virtual "No Campaign" entry if there are emails without campaign
    const noCampaignCount = countMap.get('none') || 0;
    if (noCampaignCount > 0) {
      campaigns.push({
        id: 'none',
        name: 'No Campaign',
        status: 'active',
        source: 'local',
        email_count: noCampaignCount
      });
    }

    // Backfill campaign_name into metadata for emails that have campaign_id but no campaign_name
    const missingNameRows = await db.query(
      `SELECT id, metadata FROM unibox_emails
   WHERE org_id = $1
   AND COALESCE(metadata->'item'->>'campaign_name', metadata->>'campaign_name') IS NULL
   AND COALESCE(metadata->'item'->>'campaign_id', metadata->>'campaign_id') IS NOT NULL
   LIMIT 500`,
      [orgId]
    );

    for (const row of missingNameRows.rows) {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      const campId = meta?.item?.campaign_id || meta?.campaign_id;
      const resolvedName = campId ? campaignMap.get(campId)?.name : null;
      if (resolvedName) {
        if (meta.item?.campaign_id) meta.item.campaign_name = resolvedName;
        if (meta.campaign_id) meta.campaign_name = resolvedName;
        await db.query(
          'UPDATE unibox_emails SET metadata = $1 WHERE id = $2',
          [JSON.stringify(meta), row.id]
        );
      }
    }


    res.json({ campaigns });
  } catch (err) {
    next(err);
  }

};

module.exports = {
  getEmails,
  getEmail,
  updateEmailStatus,
  toggleStarred,
  markAsRead,
  toggleArchive,
  getStats,
  getTemplates,
  convertToLead,
  checkPermission,
  getPermissions,
  grantPermission,
  revokePermission,
  createSampleEmail,
  getEmailLeadInfo,
  getCampaigns,
};
