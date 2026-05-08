const db = require('../../config/database');
const notificationService = require('../../services/notificationService');
const realtimeService = require('../../services/realtimeService');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, projectId, status, assignedTo } = req.query;
    const offset = (page - 1) * limit;

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    let query = `
      SELECT t.*,
             p.name        AS project_name,
             p.color       AS project_color,
             p.can_assign  AS project_can_assign,
             p.manager_id  AS project_manager_id,
             p.created_by  AS project_created_by,
             p.owner_id    AS project_owner_id,
             u.full_name   AS assigned_to_name,
             u.avatar_url  AS assigned_to_avatar
      FROM public.tasks t
      LEFT JOIN public.projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.org_id = $1`;

    const params = [req.user.orgId];
    let paramIndex = 2;

    if (!isAdmin) {
      // User can see task if:
      // - they are assigned to it OR created it
      // - OR they are the project manager/owner/creator (project-level access)
      query += ` AND (
        t.assigned_to = $${paramIndex} OR
        t.created_by = $${paramIndex} OR
        (t.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects pr
          WHERE pr.id = t.project_id
            AND (pr.manager_id = $${paramIndex} OR pr.owner_id = $${paramIndex} OR pr.created_by = $${paramIndex})
        ))
      )`;
      params.push(req.user.id);
      paramIndex++;
    }

    if (projectId && projectId !== 'undefined') {
      query += ` AND t.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (status && status !== 'undefined') {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (assignedTo && assignedTo !== 'undefined') {
      query += ` AND t.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    // Latest tasks first
    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Task getAll error:', err);
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT t.*,
              p.name        AS project_name,
              p.color       AS project_color,
              p.can_assign  AS project_can_assign,
              p.manager_id  AS project_manager_id,
              p.created_by  AS project_created_by,
              p.owner_id    AS project_owner_id,
              u.full_name   AS assigned_to_name,
              u.avatar_url  AS assigned_to_avatar
       FROM public.tasks t
       LEFT JOIN public.projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1 AND t.org_id = $2`,
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      title, description, projectId, assignedTo, dueDate, priority, status,
      parentTaskId, recurrence_rule, progress, can_assign
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM public.tasks WHERE org_id = $1',
      [req.user.orgId]
    );

    const result = await db.query(
      `INSERT INTO public.tasks (
        org_id, project_id, title, description, assigned_to, due_date,
        priority, status, parent_task_id, sort_order, created_by,
        is_recurring, recurrence_pattern, progress, can_assign
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        req.user.orgId,
        projectId || null,
        title.trim(),
        description || null,
        (assignedTo === '' ? null : assignedTo) || null,
        (dueDate === '' ? null : dueDate) || null,
        priority || 'normal',
        status || 'new',
        parentTaskId || null,
        maxOrder.rows[0].next_order,
        req.user.id,
        !!recurrence_rule && recurrence_rule !== 'none',
        recurrence_rule || null,
        progress || (status === 'completed' ? 100 : 0),
        can_assign || false,
      ]
    );

    const task = result.rows[0];

    if (task.assigned_to && task.assigned_to !== req.user.id) {
      notificationService.notify(
        req.user.orgId,
        task.assigned_to,
        'task_assigned',
        'New Task Assigned',
        `${req.user.full_name || req.user.email} assigned you the task "${task.title}"`,
        `/projects/tasks`,
        req.user.id,
        { taskId: task.id, taskTitle: task.title, projectId: task.project_id }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:created', task);
    res.status(201).json(task);
  } catch (err) {
    console.error('Task creation error:', err);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, description, assignedTo, dueDate, priority, status,
      recurrence_rule, is_starred, progress, can_assign
    } = req.body;

    const fields = [];
    const values = [];
    let p = 1;

    if (title !== undefined)       { fields.push(`title = $${p++}`);         values.push(title); }
    if (description !== undefined) { fields.push(`description = $${p++}`);   values.push(description); }
    if (assignedTo !== undefined)  { fields.push(`assigned_to = $${p++}`);   values.push(assignedTo === '' ? null : assignedTo); }
    if (dueDate !== undefined)     { fields.push(`due_date = $${p++}`);       values.push(dueDate === '' ? null : dueDate); }
    if (priority !== undefined)    { fields.push(`priority = $${p++}`);       values.push(priority); }
    if (status !== undefined) {
      fields.push(`status = $${p++}`);
      values.push(status);
      if (status === 'completed') {
        fields.push(`completed_at = now()`);
        fields.push(`progress = 100`);
      }
    }
    if (progress !== undefined)    { fields.push(`progress = $${p++}`);       values.push(progress); }
    if (can_assign !== undefined)  { fields.push(`can_assign = $${p++}`);     values.push(can_assign); }
    if (recurrence_rule !== undefined) {
      fields.push(`is_recurring = $${p++}`);
      values.push(!!recurrence_rule && recurrence_rule !== 'none');
      fields.push(`recurrence_pattern = $${p++}`);
      values.push(recurrence_rule || null);
    }
    if (is_starred !== undefined)  { fields.push(`is_starred = $${p++}`);     values.push(is_starred); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = now()`);
    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.tasks SET ${fields.join(', ')}
       WHERE id = $${p} AND org_id = $${p + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = result.rows[0];

    const cleanAssignedTo = assignedTo === '' ? null : assignedTo;
    if (cleanAssignedTo && cleanAssignedTo !== req.user.id) {
      notificationService.notify(
        req.user.orgId,
        cleanAssignedTo,
        'task_assigned',
        'Task Assigned to You',
        `${req.user.full_name || req.user.email} assigned you the task "${updatedTask.title}"`,
        `/projects/tasks`,
        req.user.id,
        { taskId: updatedTask.id, taskTitle: updatedTask.title }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const fields = [`status = $1`, `updated_at = now()`];
    const values = [status];

    if (status === 'completed') {
      fields.push(`completed_at = now()`);
    }

    values.push(id, req.user.orgId);

    const result = await db.query(
      `UPDATE public.tasks SET ${fields.join(', ')}
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const doneTask = result.rows[0];

    if (status === 'completed' && doneTask.created_by && doneTask.created_by !== req.user.id) {
      notificationService.notify(
        req.user.orgId,
        doneTask.created_by,
        'task_completed',
        'Task Completed',
        `${req.user.full_name || req.user.email} completed the task "${doneTask.title}"`,
        `/projects/tasks`,
        req.user.id,
        { taskId: doneTask.id, taskTitle: doneTask.title }
      );
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:updated', doneTask);
    res.json(doneTask);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM public.tasks WHERE id = $1 AND org_id = $2 RETURNING id',
      [id, req.user.orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    realtimeService.broadcastToOrg(req.user.orgId, 'task:deleted', { id });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

const reorder = async (req, res, next) => {
  try {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks array required' });
    }

    for (const task of tasks) {
      await db.query(
        'UPDATE public.tasks SET sort_order = $1, updated_at = now() WHERE id = $2 AND org_id = $3',
        [task.sortOrder, task.id, req.user.orgId]
      );
    }

    res.json({ message: 'Tasks reordered' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  updateStatus,
  remove,
  reorder,
};
