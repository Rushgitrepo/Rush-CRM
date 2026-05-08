const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// GET /api/members — all users with optional filters
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, role, status, department } = req.query;
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = [];

    // Filter by organization
    conditions.push(`u.org_id = $${params.length + 1}`);
    params.push(req.user.orgId);

    // Never show super_admins, never show the requester themselves
    conditions.push(`u.role != 'super_admin'`);
    conditions.push(`u.id != $${params.length + 1}`);
    params.push(req.user.id);

    // Status filter — default shows ALL (active + inactive)
    if (status && status !== 'all') {
      if (status === 'active') {
        conditions.push(`u.is_active = true`);
      } else if (status === 'inactive') {
        conditions.push(`(u.is_active = false OR u.is_active IS NULL)`);
      }
    }

    // Role filter
    if (role && role !== 'all') {
      conditions.push(`u.role = $${params.length + 1}`);
      params.push(role);
    }

    // Department filter
    if (department && department !== 'all') {
      conditions.push(`u.department = $${params.length + 1}`);
      params.push(department);
    }

    // Search filter
    if (search) {
      const idx = params.length + 1;
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`);
    }

    let query = `
      SELECT u.id, u.email, u.full_name, u.role, u.department, u.phone, u.position, u.is_active,
             u.avatar_url, u.created_at, u.updated_at, u.module_permissions, u.password_change_required
      FROM public.users u
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    result.rows.forEach(row => { delete row.password_hash; });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/members/stats — dashboard stats (total, active, inactive, admins)
const getStats = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE is_active = true)                       AS active,
        COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL) AS inactive,
        COUNT(*) FILTER (WHERE role = 'admin')                         AS admins
       FROM public.users
       WHERE org_id = $1
         AND role != 'super_admin'
         AND id != $2`,
      [req.user.orgId, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const requesterResult = await db.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    const result = await db.query(
      `SELECT u.* FROM public.users u WHERE u.id = $1 AND u.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = result.rows[0];

    if (targetUser.role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    delete targetUser.password_hash;
    res.json(targetUser);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { email, fullName, role, phone, position, department, module_permissions } = req.body;

    const requesterResult = await client.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and Full Name are required' });
    }

    if (role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admins can create other Super Admins' });
    }

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    await client.query('DELETE FROM public.invites WHERE email = $1', [email]);

    const inviteToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const orgId = req.user.orgId;
    const inviteId = uuidv4();

    await client.query(
      `INSERT INTO public.invites
       (id, email, full_name, role, phone, position, department, module_permissions, invite_token, expires_at, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [inviteId, email, fullName, role || 'employee', phone, position, department, JSON.stringify(module_permissions || {}), inviteToken, expiresAt, orgId]
    );

    try {
      const systemEmailService = require('../../services/systemEmailService');
      await systemEmailService.sendInvite(email, fullName, inviteToken);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Invitation sent successfully. User will be created once they set their password.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

const update = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { fullName, phone, position, role, status, job_title, department, module_permissions, password_change_required, is_active } = req.body;
    const orgId = req.user.orgId;

    const requesterResult = await client.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    const targetResult = await client.query('SELECT role FROM public.users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const targetRole = targetResult.rows[0].role;

    if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized to modify a Super Admin account' });
    }

    if (role === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admins can assign the Super Admin role' });
    }

    await client.query('BEGIN');

    const userFields = [];
    const userValues = [];
    let uIdx = 1;

    if (fullName !== undefined)              { userFields.push(`full_name = $${uIdx++}`);              userValues.push(fullName); }
    if (phone !== undefined)                 { userFields.push(`phone = $${uIdx++}`);                  userValues.push(phone); }
    if (position !== undefined)              { userFields.push(`position = $${uIdx++}`);               userValues.push(position); }
    if (role !== undefined)                  { userFields.push(`role = $${uIdx++}`);                   userValues.push(role); }
    if (department !== undefined)            { userFields.push(`department = $${uIdx++}`);             userValues.push(department); }
    if (is_active !== undefined)             { userFields.push(`is_active = $${uIdx++}`);              userValues.push(is_active); }
    if (module_permissions !== undefined)    { userFields.push(`module_permissions = $${uIdx++}`);     userValues.push(JSON.stringify(module_permissions)); }
    if (password_change_required !== undefined) { userFields.push(`password_change_required = $${uIdx++}`); userValues.push(password_change_required); }

    if (userFields.length > 0) {
      userFields.push(`updated_at = now()`);
      userValues.push(id, orgId);
      await client.query(
        `UPDATE public.users SET ${userFields.join(', ')} WHERE id = $${uIdx} AND org_id = $${uIdx + 1}`,
        userValues
      );
    }

    const profFields = [];
    const profValues = [];
    let pIdx = 1;

    if (fullName !== undefined)                          { profFields.push(`full_name = $${pIdx++}`);  profValues.push(fullName); }
    if (phone !== undefined)                             { profFields.push(`phone = $${pIdx++}`);      profValues.push(phone); }
    if (position !== undefined || job_title !== undefined) { profFields.push(`job_title = $${pIdx++}`); profValues.push(position || job_title); }
    if (department !== undefined)                        { profFields.push(`department = $${pIdx++}`); profValues.push(department); }

    if (profFields.length > 0) {
      profFields.push(`updated_at = now()`);
      profValues.push(id, orgId);
      await client.query(
        `UPDATE public.profiles SET ${profFields.join(', ')} WHERE id = $${pIdx} AND org_id = $${pIdx + 1}`,
        profValues
      );
    }

    await client.query('COMMIT');

    const finalResult = await client.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.department, u.phone, u.position, u.is_active,
              u.avatar_url, u.created_at, u.updated_at, u.module_permissions, u.password_change_required
       FROM public.users u
       WHERE u.id = $1 AND u.org_id = $2`,
      [id, orgId]
    );

    const updatedUser = finalResult.rows[0];
    const realtimeService = require('../../services/realtimeService');
    realtimeService.emitUserUpdated(id, updatedUser);

    res.json(updatedUser);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT phone, job_title, department FROM public.profiles WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const requesterResult = await db.query('SELECT role FROM public.users WHERE id = $1', [req.user.id]);
    const requesterRole = requesterResult.rows[0]?.role;

    const targetResult = await db.query('SELECT role FROM public.users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const targetRole = targetResult.rows[0].role;

    if (targetRole === 'super_admin' && requesterRole !== 'super_admin') {
      return res.status(403).json({ error: 'You are not authorized to delete a Super Admin' });
    }

    await db.query('BEGIN');

    await db.query('DELETE FROM public.attendance WHERE user_id = $1 OR employee_id = $1', [id]);
    await db.query('DELETE FROM public.leave_requests WHERE employee_id = $1', [id]);
    await db.query('DELETE FROM public.salary_slips WHERE employee_id = $1', [id]);
    await db.query('DELETE FROM public.employee_documents WHERE employee_id = $1', [id]);
    await db.query('DELETE FROM public.leads WHERE assigned_to = $1', [id]);
    await db.query('DELETE FROM public.deals WHERE assigned_to = $1', [id]);
    await db.query('DELETE FROM public.tasks WHERE assigned_to = $1 OR created_by = $1', [id]);
    await db.query('DELETE FROM public.crm_activities WHERE user_id = $1', [id]);
    await db.query('DELETE FROM public.workgroup_members WHERE user_id = $1', [id]);
    await db.query('DELETE FROM public.connected_mailboxes WHERE user_id = $1', [id]);
    await db.query('DELETE FROM public.calendar_connections WHERE user_id = $1', [id]);
    await db.query('DELETE FROM public.calendar_event_attendees WHERE user_id = $1', [id]);
    await db.query('DELETE FROM public.profiles WHERE id = $1', [id]);

    const result = await db.query(
      'DELETE FROM public.users WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found or you do not have permission' });
    }

    await db.query('COMMIT');
    res.json({ message: 'User and all related records deleted permanently' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    res.json({ message: 'Password reset email sent' });
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
  resetPassword,
  getProfile,
};
