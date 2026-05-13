const db = require('../../config/database');

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
      priority = 'all'
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
        updated_at
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
    const { title, company_name, company_email, company_phone, interaction_notes } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Lead title is required' });
    }

    // Fetch email details first to get sender information
    const emailResult = await db.query(
      'SELECT sender_name, sender_email, subject, body_text FROM unibox_emails WHERE id = $1 AND org_id = $2',
      [id, req.user.orgId]
    );

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    const email = emailResult.rows[0];

    // Create the lead
    const leadResult = await db.query(
      `INSERT INTO leads (org_id, title, name, email, phone, company, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.orgId,
        title || email.subject || 'Lead from Unibox',
        company_name || email.sender_name || 'Prospect',
        company_email || email.sender_email,
        company_phone || null,
        company_name || null,
        interaction_notes || email.body_text?.substring(0, 1000) || '',
        req.user.id
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

module.exports = {
  getEmails,
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
};
