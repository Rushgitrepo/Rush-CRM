const db = require('../../config/database');
const { getUserAccessibleProjects } = require('../../middleware/projectAccess');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    // Get only projects user has access to (owns or is member of)
    const { query, params } = getUserAccessibleProjects(
      req.user.id, 
      req.user.orgId, 
      { status, limit, offset }
    );

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        COUNT(*) as total
       FROM public.projects WHERE org_id = $1`,
      [req.user.orgId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user has access to this project
    const result = await db.query(`
      SELECT DISTINCT p.* 
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = $1 AND p.org_id = $2 
      AND (p.owner_id = $3 OR pm.user_id = $3)
    `, [id, req.user.orgId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    console.log('Creating project with data:', req.body);
    const { name, description, startDate, endDate, color, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await db.query(
      `INSERT INTO public.projects (
        org_id, owner_id, name, description, start_date, end_date, color, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.orgId, 
        req.user.id, 
        name.trim(), 
        description || null, 
        startDate || null, 
        endDate || null, 
        color || 'bg-primary', 
        status || 'active'
      ]
    );

    console.log('Project created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Project creation error:', err);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, color, status } = req.body;

    // Check if user has access to this project
    const accessCheck = await db.query(`
      SELECT p.id 
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
      WHERE p.id = $1 AND p.org_id = $3 
      AND (p.owner_id = $2 OR pm.user_id IS NOT NULL)
    `, [id, req.user.id, req.user.orgId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (startDate !== undefined) { fields.push(`start_date = $${paramIndex++}`); values.push(startDate); }
    if (endDate !== undefined) { fields.push(`end_date = $${paramIndex++}`); values.push(endDate); }
    if (color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(color); }
    if (status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.projects SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only project owner can delete the project
    const result = await db.query(
      'DELETE FROM public.projects WHERE id = $1 AND org_id = $2 AND owner_id = $3 RETURNING id',
      [id, req.user.orgId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Only project owner can delete the project' });
    }

    res.json({ message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
};

const getMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT pm.*, u.full_name, u.email, u.avatar_url
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1 AND pm.org_id = $2
       ORDER BY pm.created_at ASC`,
      [id, req.user.orgId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await db.query(
      `INSERT INTO project_members (org_id, project_id, user_id, role)
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $4
       RETURNING *`,
      [req.user.orgId, id, user_id, role || 'member']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    const result = await db.query(
      'DELETE FROM project_members WHERE id = $1 AND project_id = $2 AND org_id = $3 RETURNING id',
      [memberId, id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getStats,
  getById,
  create,
  update,
  remove,
  getMembers,
  addMember,
  removeMember,
};


const getComments = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    const tableCheck = await db.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_comments')`
    );
    if (!tableCheck.rows[0].exists) return res.json([]);
    const { rows } = await db.query(
      `SELECT c.*, u.full_name, u.avatar_url 
       FROM project_comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.org_id = $3 
       ORDER BY c.created_at ASC`,
      [entity_type, entity_id, req.user.orgId]
    );
    
    const comments = rows.map(r => ({
      ...r,
      profile: r.full_name ? {
        full_name: r.full_name,
        avatar_url: r.avatar_url
      } : null
    }));
    
    res.json(comments);
  } catch (err) {
    console.error('Project comments error:', err);
    res.json([]);
  }
};

const createComment = async (req, res) => {
  try {
    const { content, entity_type, entity_id } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const tableCheck = await db.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_comments')`
    );
    if (!tableCheck.rows[0].exists) return res.status(501).json({ error: 'Comments feature not available' });
    const { rows } = await db.query(
      'INSERT INTO project_comments (comment, entity_type, entity_id, org_id, user_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [content, entity_type, entity_id, req.user.orgId, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Project comments creation error:', err);
    res.status(500).json({ error: err.message });
  }
};

const getReport = async (req, res, next) => {
  try {
    const token = req.params.token;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    
    if (!isUUID) {
      // Token is a share token (hex string)
      const { rows: shareRows } = await db.query(
        'SELECT * FROM project_shares WHERE share_token = $1',
        [token]
      );
      
      if (shareRows.length === 0) {
        return res.status(404).json({ error: 'Share link not found' });
      }
      
      if (!shareRows[0].is_active) {
        return res.status(403).json({ error: 'Access denied. This share link has been disabled.' });
      }
      
      const share = shareRows[0];
      const { rows: projectRows } = await db.query('SELECT * FROM public.projects WHERE id = $1', [share.project_id]);
      if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
      const project = projectRows[0];
      const { rows: taskRows } = await db.query('SELECT * FROM public.tasks WHERE project_id = $1 ORDER BY sort_order ASC', [share.project_id]);
      return res.json({ project, milestones: [], tasks: taskRows, permissions: { canEdit: false } });
    }
    
    // Token is a UUID - authenticated access
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { rows: projectRows } = await db.query('SELECT * FROM public.projects WHERE id = $1 AND org_id = $2', [token, req.user.orgId]);
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];
    const { rows: taskRows } = await db.query('SELECT * FROM public.tasks WHERE project_id = $1 AND org_id = $2 ORDER BY sort_order ASC', [token, req.user.orgId]);
    res.json({ project, milestones: [], tasks: taskRows, permissions: { canEdit: true } });
  } catch (err) {
    next(err);
  }
};

const getShares = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM project_shares 
       WHERE project_id = $1 AND org_id = $2 
       ORDER BY created_at DESC`,
      [id, req.user.orgId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const createShare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { client_name, client_email } = req.body;
    
    // Generate a unique share token
    const crypto = require('crypto');
    const share_token = crypto.randomBytes(32).toString('hex');
    
    const { rows } = await db.query(
      `INSERT INTO project_shares (org_id, project_id, share_token, client_name, client_email, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [req.user.orgId, id, share_token, client_name || null, client_email || null]
    );
    
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateShare = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const { is_active } = req.body;
    
    const { rows } = await db.query(
      `UPDATE project_shares 
       SET is_active = $1, updated_at = now()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [is_active, shareId, req.user.orgId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getStats,
  getById,
  create,
  update,
  remove,
  getMembers,
  addMember,
  removeMember,
  getComments,
  createComment,
  getReport,
  getShares,
  createShare,
  updateShare,
};
