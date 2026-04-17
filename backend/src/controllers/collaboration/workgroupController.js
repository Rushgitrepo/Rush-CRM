const db = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const realtimeService = require('../../services/realtimeService');
const pushService = require('../../services/pushService');

const createSystemPost = async (workgroupId, actorUserId, content) => {
  const postId = uuidv4();
  await db.query(
    `INSERT INTO workgroup_posts (
      id, workgroup_id, user_id, content, content_type
    ) VALUES ($1, $2, $3, $4, $5)`,
    [postId, workgroupId, actorUserId, `[SYSTEM] ${content}`, 'text']
  );

  const postResult = await db.query(
    `SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
     FROM workgroup_posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [postId]
  );

  if (postResult.rows[0]) {
    realtimeService.emitWorkgroupPost(workgroupId, postResult.rows[0]);
  }
};

// Get all workgroups for organization
const getWorkgroups = async (req, res, next) => {
  try {
    const { type, search } = req.query;
    
    let query = `
      SELECT 
        w.*,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT u_peer.full_name
            FROM workgroup_members wm_peer
            JOIN users u_peer ON u_peer.id = wm_peer.user_id
            WHERE wm_peer.workgroup_id = w.id
              AND wm_peer.user_id <> $1
            ORDER BY wm_peer.joined_at ASC
            LIMIT 1
          )
          ELSE w.name
        END as display_name,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT wm_peer.user_id
            FROM workgroup_members wm_peer
            WHERE wm_peer.workgroup_id = w.id
              AND wm_peer.user_id <> $1
            ORDER BY wm_peer.joined_at ASC
            LIMIT 1
          )
          ELSE NULL
        END as direct_peer_user_id,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT COALESCE(u_peer.last_seen_at, u_peer.last_login)
            FROM workgroup_members wm_peer
            JOIN users u_peer ON u_peer.id = wm_peer.user_id
            WHERE wm_peer.workgroup_id = w.id
              AND wm_peer.user_id <> $1
            ORDER BY wm_peer.joined_at ASC
            LIMIT 1
          )
          ELSE NULL
        END as direct_peer_last_seen_at,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT u_peer.avatar_url
            FROM workgroup_members wm_peer
            JOIN users u_peer ON u_peer.id = wm_peer.user_id
            WHERE wm_peer.workgroup_id = w.id
              AND wm_peer.user_id <> $1
            ORDER BY wm_peer.joined_at ASC
            LIMIT 1
          )
          ELSE NULL
        END as direct_peer_avatar_url,
        u.full_name as created_by_name,
        COUNT(DISTINCT wm.user_id) as member_count,
        COUNT(DISTINCT wp.id) as message_count,
        COUNT(
          DISTINCT CASE
            WHEN wp.created_at >= CURRENT_DATE THEN wp.id
            ELSE NULL
          END
        ) as today_message_count,
        MAX(wp.created_at) as last_message_at,
        (
          SELECT u2.full_name
          FROM workgroup_posts p2
          JOIN users u2 ON u2.id = p2.user_id
          WHERE p2.workgroup_id = w.id
            AND p2.is_deleted = false
          ORDER BY p2.created_at DESC
          LIMIT 1
        ) as last_message_sender_name,
        (
          SELECT COUNT(*)::int
          FROM workgroup_posts p3
          WHERE p3.workgroup_id = w.id
            AND p3.is_deleted = false
            AND p3.user_id <> $1
            AND NOT ($1::uuid = ANY(COALESCE(p3.deleted_for_users, '{}'::uuid[])))
            AND NOT EXISTS (
              SELECT 1
              FROM workgroup_post_reads r
              WHERE r.post_id = p3.id
                AND r.user_id = $1
            )
        ) as unread_count,
        EXISTS (
          SELECT 1
          FROM workgroup_members wm_self
          WHERE wm_self.workgroup_id = w.id
            AND wm_self.user_id = $1
        ) as is_member
      FROM workgroups w
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id
      LEFT JOIN workgroup_posts wp ON w.id = wp.workgroup_id AND wp.is_deleted = false
      WHERE w.org_id = $2 AND w.is_archived = false
    `;
    
    const params = [req.user.id, req.user.orgId];
    let paramIndex = 3;
    
    // Filter by type
    if (type && type !== 'all') {
      query += ` AND w.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    // Search filter
    if (search) {
      query += ` AND (w.name ILIKE $${paramIndex} OR w.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Only show workgroups the current user is a member of.
    query += `
      AND EXISTS (
        SELECT 1
        FROM workgroup_members wm_self
        WHERE wm_self.workgroup_id = w.id
          AND wm_self.user_id = $1
      )
    `;
    
    query += `
      GROUP BY w.id, u.full_name
      ORDER BY COALESCE(MAX(wp.created_at), w.last_activity_at, w.created_at) DESC
    `;
    
    const result = await db.query(query, params);
    
    // Add activity indicators
    const workgroups = result.rows.map((wg) => {
      let isOnline = false;
      let lastSeenAt = null;
      if (wg.direct_peer_user_id) {
        const presence = realtimeService.getUserPresence(wg.direct_peer_user_id);
        isOnline = Boolean(presence.isOnline);
        lastSeenAt = presence.lastSeenAt || wg.direct_peer_last_seen_at || null;
      }

      return {
        ...wg,
        has_recent_activity:
          wg.last_message_at &&
          new Date(wg.last_message_at) > new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        is_online: isOnline,
        last_seen_at: lastSeenAt,
      };
    });
    
    res.json(workgroups);
  } catch (err) {
    next(err);
  }
};

// Get single workgroup
const getWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        w.*,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT u_peer.full_name
            FROM workgroup_members wm_peer
            JOIN users u_peer ON u_peer.id = wm_peer.user_id
            WHERE wm_peer.workgroup_id = w.id
              AND wm_peer.user_id <> $1
            ORDER BY wm_peer.joined_at ASC
            LIMIT 1
          )
          ELSE w.name
        END as display_name,
        CASE
          WHEN COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true THEN (
            SELECT u_peer.avatar_url
            FROM workgroup_members wm_peer
            JOIN users u_peer ON u_peer.id = wm_peer.user_id
            WHERE wm_peer.workgroup_id = w.id
              AND wm_peer.user_id <> $1
            ORDER BY wm_peer.joined_at ASC
            LIMIT 1
          )
          ELSE NULL
        END as direct_peer_avatar_url,
        u.full_name as created_by_name,
        COUNT(DISTINCT wm.user_id) as member_count,
        COUNT(DISTINCT wp.id) as message_count,
        CASE 
          WHEN wm_current.user_id IS NOT NULL THEN wm_current.role 
          ELSE null 
        END as user_role
      FROM workgroups w
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id
      LEFT JOIN workgroup_posts wp ON w.id = wp.workgroup_id AND wp.is_deleted = false
      LEFT JOIN workgroup_members wm_current ON w.id = wm_current.workgroup_id AND wm_current.user_id = $1
      WHERE w.id = $2 AND w.org_id = $3 AND w.is_archived = false
      GROUP BY w.id, u.full_name, wm_current.user_id, wm_current.role
    `;
    
    const result = await db.query(query, [req.user.id, id, req.user.orgId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }
    
    const workgroup = result.rows[0];
    
    // Check if user can access private workgroup
    if (workgroup.is_private && !workgroup.user_role) {
      return res.status(403).json({ error: 'Access denied to private workgroup' });
    }
    
    res.json(workgroup);
  } catch (err) {
    next(err);
  }
};

// Create workgroup
const createWorkgroup = async (req, res, next) => {
  try {
    const { name, description, avatar_color, type, is_private } = req.body;
    const normalizedType = type || 'team';
    const normalizedIsPrivate = normalizedType === 'private' ? true : false;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workgroup name is required' });
    }
    
    // Check if name already exists in organization
    const existingQuery = `
      SELECT id FROM workgroups 
      WHERE org_id = $1 AND LOWER(name) = LOWER($2) AND is_archived = false
    `;
    const existing = await db.query(existingQuery, [req.user.orgId, name.trim()]);
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A workgroup with this name already exists' });
    }
    
    const id = uuidv4();
    await db.query('BEGIN');

    const query = `
      INSERT INTO workgroups (
        id, org_id, name, description, avatar_color, type, is_private, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id,
      req.user.orgId,
      name.trim(),
      description?.trim() || null,
      avatar_color || 'bg-blue-500',
      normalizedType,
      normalizedIsPrivate,
      req.user.id
    ]);

    // Auto-add creator as owner so team can chat immediately.
    await db.query(
      `INSERT INTO workgroup_members (workgroup_id, user_id, role, invited_by)
       VALUES ($1, $2, 'owner', $2)
       ON CONFLICT (workgroup_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );
    
    // Log activity
    await logActivity(id, req.user.id, 'workgroup_created', {
      workgroup_name: name.trim(),
      type: type || 'team'
    });

    await db.query('COMMIT');

    realtimeService.emitWorkgroupUpdated(req.user.orgId, {
      action: 'created',
      workgroup_id: id,
      workgroup: result.rows[0],
    });
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    next(err);
  }
};

// Update workgroup
const updateWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      avatar_color,
      type,
      is_private,
      manage_member_user_id,
    } = req.body;
    const normalizedType = type;
    const normalizedIsPrivate =
      normalizedType === undefined
        ? is_private
        : normalizedType === 'private';
    
    // Check if user is admin or owner
    const memberQuery = `
      SELECT role FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);
    
    if (memberResult.rows.length === 0 || 
        !['owner', 'admin'].includes(memberResult.rows[0].role)) {
      return res.status(403).json({ error: 'Only workgroup owners and admins can update workgroup settings' });
    }
    
    if (name && name.trim()) {
      // Check if new name conflicts with existing workgroup
      const existingQuery = `
        SELECT id FROM workgroups 
        WHERE org_id = $1 AND LOWER(name) = LOWER($2) AND id != $3 AND is_archived = false
      `;
      const existing = await db.query(existingQuery, [req.user.orgId, name.trim(), id]);
      
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'A workgroup with this name already exists' });
      }
    }
    
    const query = `
      UPDATE workgroups 
      SET 
        name = COALESCE($1, name),
        description = $2,
        avatar_color = COALESCE($3, avatar_color),
        type = COALESCE($4, type),
        is_private = COALESCE($5, is_private),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND org_id = $7
      RETURNING *
    `;
    
    const result = await db.query(query, [
      name?.trim(),
      description?.trim(),
      avatar_color,
      normalizedType,
      normalizedIsPrivate,
      id,
      req.user.orgId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }

    // Optional: assign a specific non-admin/owner member who can add/remove members.
    if (manage_member_user_id !== undefined) {
      if (manage_member_user_id) {
        const targetMemberCheck = await db.query(
          `
            SELECT wm.user_id
            FROM workgroup_members wm
            JOIN users u ON u.id = wm.user_id
            WHERE wm.workgroup_id = $1
              AND wm.user_id = $2
              AND u.org_id = $3
          `,
          [id, manage_member_user_id, req.user.orgId],
        );
        if (targetMemberCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Assigned user must be a member of this team' });
        }
      }

      await db.query(
        `
          UPDATE workgroups
          SET settings = CASE
            WHEN $1::text IS NULL
              THEN COALESCE(settings, '{}'::jsonb) - 'member_manager_user_id'
            ELSE jsonb_set(
              COALESCE(settings, '{}'::jsonb),
              '{member_manager_user_id}',
              to_jsonb($1::text),
              true
            )
          END,
          updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND org_id = $3
        `,
        [manage_member_user_id || null, id, req.user.orgId],
      );
    }
    
    // Log activity
    await logActivity(id, req.user.id, 'workgroup_updated', {
      changes: { name, description, avatar_color, type, is_private }
    });

    const latestResult = await db.query(
      `SELECT * FROM workgroups WHERE id = $1 AND org_id = $2`,
      [id, req.user.orgId]
    );
    const latestWorkgroup = latestResult.rows[0] || result.rows[0];

    realtimeService.emitWorkgroupUpdated(req.user.orgId, {
      action: 'updated',
      workgroup_id: id,
      workgroup: latestWorkgroup,
    });

    res.json(latestWorkgroup);
  } catch (err) {
    next(err);
  }
};

// Delete workgroup
const deleteWorkgroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user is owner
    const memberQuery = `
      SELECT role FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);
    
    if (memberResult.rows.length === 0 || memberResult.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only workgroup owners can delete workgroups' });
    }
    
    // Soft delete by archiving
    const query = `
      UPDATE workgroups 
      SET is_archived = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND org_id = $2
      RETURNING name
    `;
    
    const result = await db.query(query, [id, req.user.orgId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }
    
    // Log activity
    await logActivity(id, req.user.id, 'workgroup_deleted', {
      workgroup_name: result.rows[0].name
    });

    realtimeService.emitWorkgroupUpdated(req.user.orgId, {
      action: 'deleted',
      workgroup_id: id,
      workgroup: { id },
    });
    
    res.json({ message: 'Workgroup deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Get workgroup members
const getWorkgroupMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user has access to workgroup
    const accessQuery = `
      SELECT w.is_private, wm.user_id
      FROM workgroups w
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id AND wm.user_id = $1
      WHERE w.id = $2 AND w.org_id = $3
    `;
    const accessResult = await db.query(accessQuery, [req.user.id, id, req.user.orgId]);
    
    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }
    
    if (accessResult.rows[0].is_private && !accessResult.rows[0].user_id) {
      return res.status(403).json({ error: 'Access denied to private workgroup' });
    }

    // When user opens the workgroup, mark all messages from others as read.
    await db.query(
      `
        INSERT INTO workgroup_post_reads (post_id, user_id, read_at)
        SELECT p.id, $2::uuid, CURRENT_TIMESTAMP
        FROM workgroup_posts p
        WHERE p.workgroup_id = $1
          AND p.user_id <> $2
          AND p.is_deleted = false
          AND NOT ($2::uuid = ANY(COALESCE(p.deleted_for_users, '{}'::uuid[])))
        ON CONFLICT (post_id, user_id) DO UPDATE
        SET read_at = EXCLUDED.read_at
      `,
      [id, req.user.id],
    );
    
    const query = `
      SELECT 
        wm.*,
        u.full_name,
        u.email,
        u.avatar_url,
        u.last_login,
        u.last_seen_at as persisted_last_seen_at,
        u.role as user_role,
        ui.full_name as invited_by_name
      FROM workgroup_members wm
      JOIN users u ON wm.user_id = u.id
      LEFT JOIN users ui ON wm.invited_by = ui.id
      WHERE wm.workgroup_id = $1
      ORDER BY 
        CASE wm.role 
          WHEN 'owner' THEN 1 
          WHEN 'admin' THEN 2 
          WHEN 'member' THEN 3 
          WHEN 'guest' THEN 4 
        END,
        wm.joined_at ASC
    `;
    
    const result = await db.query(query, [id]);
    const membersWithPresence = result.rows.map((member) => {
      const presence = realtimeService.getUserPresence(member.user_id);
      return {
        ...member,
        is_online: presence.isOnline,
        last_seen_at:
          presence.lastSeenAt ||
          member.persisted_last_seen_at ||
          member.last_login ||
          null,
      };
    });
    res.json(membersWithPresence);
  } catch (err) {
    next(err);
  }
};

// Add member to workgroup
const addWorkgroupMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check workgroup and enforce org isolation
    const workgroupCheckQuery = `
      SELECT id, org_id FROM workgroups
      WHERE id = $1 AND is_archived = false
    `;
    const workgroupCheckResult = await db.query(workgroupCheckQuery, [id]);
    if (workgroupCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }
    if (workgroupCheckResult.rows[0].org_id !== req.user.orgId) {
      return res.status(403).json({ error: 'You cannot manage members outside your organization' });
    }

    // Check if current user can add members
    const permissionQuery = `
      SELECT wm.role, w.allow_member_add_remove, w.created_by, w.settings
      FROM workgroup_members wm
      JOIN workgroups w ON wm.workgroup_id = w.id
      WHERE wm.workgroup_id = $1 AND wm.user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [id, req.user.id]);
    
    if (permissionResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this workgroup' });
    }
    
    const {
      role: currentUserRole,
      allow_member_add_remove,
      created_by,
      settings,
    } = permissionResult.rows[0];
    const isTeamCreator = created_by === req.user.id;
    const assignedManagerUserId = settings?.member_manager_user_id || null;
    const isAssignedMemberManager = assignedManagerUserId === req.user.id;
    
    if (
      !['owner', 'admin'].includes(currentUserRole) &&
      !allow_member_add_remove &&
      !isTeamCreator &&
      !isAssignedMemberManager
    ) {
      return res.status(403).json({ error: 'You do not have permission to add members' });
    }
    
    // Check if user exists in same organization
    const userQuery = `
      SELECT id, full_name FROM users 
      WHERE id = $1 AND org_id = $2
    `;
    const userResult = await db.query(userQuery, [user_id, req.user.orgId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is already a member
    const existingQuery = `
      SELECT id FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const existingResult = await db.query(existingQuery, [id, user_id]);
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this workgroup' });
    }
    
    const insertQuery = `
      INSERT INTO workgroup_members (workgroup_id, user_id, role, invited_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await db.query(insertQuery, [
      id,
      user_id,
      role || 'member',
      req.user.id
    ]);
    
    // Log activity
    await logActivity(id, req.user.id, 'member_added', {
      added_user_name: userResult.rows[0].full_name,
      role: role || 'member'
    });

    const actorResult = await db.query(
      'SELECT full_name FROM users WHERE id = $1',
      [req.user.id]
    );
    const actorName = actorResult.rows[0]?.full_name || 'A member';
    const addedName = userResult.rows[0]?.full_name || 'a user';
    try {
      await createSystemPost(id, req.user.id, `${actorName} added ${addedName} to the team.`);
    } catch (systemErr) {
      // Do not fail add-member API if system activity post fails.
      console.error('Failed to create system activity post (member_added):', systemErr.message);
    }

    // Notify all members in the workgroup to refresh their member list.
    realtimeService.emitWorkgroupMemberAdded(id, result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Remove member from workgroup
const removeWorkgroupMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    
    // Get member details
    const memberQuery = `
      SELECT wm.user_id, wm.role, u.full_name
      FROM workgroup_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.id = $1 AND wm.workgroup_id = $2
    `;
    const memberResult = await db.query(memberQuery, [memberId, id]);
    
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    const { user_id: targetUserId, role: targetRole, full_name } = memberResult.rows[0];
    
    // Check permissions
    const permissionQuery = `
      SELECT wm.role, w.created_by, w.settings
      FROM workgroup_members wm
      JOIN workgroups w ON wm.workgroup_id = w.id
      WHERE wm.workgroup_id = $1 AND wm.user_id = $2
    `;
    const permissionResult = await db.query(permissionQuery, [id, req.user.id]);
    
    if (permissionResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this workgroup' });
    }
    
    const currentUserRole = permissionResult.rows[0].role;
    const isTeamCreator = permissionResult.rows[0].created_by === req.user.id;
    const assignedManagerUserId =
      permissionResult.rows[0].settings?.member_manager_user_id || null;
    const isAssignedMemberManager = assignedManagerUserId === req.user.id;
    
    // Users can remove themselves, owners can remove anyone, admins can remove members/guests
    if (targetUserId !== req.user.id) {
      if (currentUserRole === 'owner') {
        // Owners can remove anyone except other owners
        if (targetRole === 'owner') {
          return res.status(403).json({ error: 'Cannot remove other owners' });
        }
      } else if (currentUserRole === 'admin') {
        // Admins can only remove members and guests
        if (['owner', 'admin'].includes(targetRole)) {
          return res.status(403).json({ error: 'Cannot remove owners or other admins' });
        }
      } else if (!isTeamCreator && !isAssignedMemberManager) {
        return res.status(403).json({ error: 'You do not have permission to remove members' });
      }
    }
    
    const deleteQuery = `
      DELETE FROM workgroup_members 
      WHERE id = $1 AND workgroup_id = $2
    `;
    
    await db.query(deleteQuery, [memberId, id]);
    
    // Log activity
    await logActivity(id, req.user.id, 'member_removed', {
      removed_user_name: full_name,
      was_self_removal: targetUserId === req.user.id
    });

    const actorResult = await db.query(
      'SELECT full_name FROM users WHERE id = $1',
      [req.user.id]
    );
    const actorName = actorResult.rows[0]?.full_name || 'A member';
    const removedName = full_name || 'a user';
    const systemMessage =
      targetUserId === req.user.id
        ? `${removedName} left the team.`
        : `${actorName} removed ${removedName} from the team.`;
    try {
      await createSystemPost(id, req.user.id, systemMessage);
    } catch (systemErr) {
      // Do not fail remove-member API if system activity post fails.
      console.error('Failed to create system activity post (member_removed):', systemErr.message);
    }

    // Notify all members in the workgroup to refresh their member list.
    realtimeService.emitWorkgroupMemberRemoved(id, memberId);

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
};

// Get workgroup posts/messages
const getWorkgroupPosts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { channel_id, limit = 50, offset = 0 } = req.query;
    
    // Check access
    const accessQuery = `
      SELECT w.is_private, wm.user_id
      FROM workgroups w
      LEFT JOIN workgroup_members wm ON w.id = wm.workgroup_id AND wm.user_id = $1
      WHERE w.id = $2 AND w.org_id = $3
    `;
    const accessResult = await db.query(accessQuery, [req.user.id, id, req.user.orgId]);
    
    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workgroup not found' });
    }
    
    if (accessResult.rows[0].is_private && !accessResult.rows[0].user_id) {
      return res.status(403).json({ error: 'Access denied to private workgroup' });
    }
    
    let query = `
      WITH RECURSIVE post_tree AS (
        -- Get parent posts
        SELECT 
          p.*,
          u.full_name as author_name,
          u.avatar_url as author_avatar,
          0 as depth,
          p.id as root_id
        FROM workgroup_posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.workgroup_id = $1 
          AND p.parent_id IS NULL 
          AND (
            p.is_deleted = false
            OR p.is_deleted = true
            OR $2::uuid = ANY(COALESCE(p.deleted_for_users, '{}'::uuid[]))
          )
    `;
    
    const params = [id, req.user.id];
    let paramIndex = 3;
    
    if (channel_id) {
      query += ` AND p.channel_id = $${paramIndex}`;
      params.push(channel_id);
      paramIndex++;
    }
    
    query += `
        UNION ALL
        -- Get replies
        SELECT 
          p.*,
          u.full_name as author_name,
          u.avatar_url as author_avatar,
          pt.depth + 1,
          pt.root_id
        FROM workgroup_posts p
        JOIN users u ON p.user_id = u.id
        JOIN post_tree pt ON p.parent_id = pt.id
        WHERE (
          p.is_deleted = false
          OR p.is_deleted = true
          OR $2::uuid = ANY(COALESCE(p.deleted_for_users, '{}'::uuid[]))
        )
      )
      SELECT * FROM post_tree
      ORDER BY root_id DESC, depth ASC, created_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);

    // Build seen-count map for tick color rendering.
    const allPostIds = result.rows.map((post) => post.id);
    const seenCountMap = new Map();
    if (allPostIds.length > 0) {
      const seenResult = await db.query(
        `
          SELECT post_id, COUNT(*)::int AS seen_count
          FROM workgroup_post_reads
          WHERE post_id = ANY($1::uuid[])
          GROUP BY post_id
        `,
        [allPostIds],
      );
      seenResult.rows.forEach((row) => {
        seenCountMap.set(row.post_id, row.seen_count);
      });
    }
    
    // Group replies under parent posts
    const postsMap = new Map();
    const rootPosts = [];
    
    result.rows.forEach(post => {
      post.seen_count = seenCountMap.get(post.id) || 0;
      if (post.depth === 0) {
        post.replies = [];
        postsMap.set(post.id, post);
        rootPosts.push(post);
      } else {
        const parentPost = postsMap.get(post.root_id);
        if (parentPost) {
          parentPost.replies.push(post);
        }
      }
    });
    
    res.json(rootPosts);
  } catch (err) {
    next(err);
  }
};

// Create post/message
const createWorkgroupPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, channel_id, parent_id, content_type } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Check if user is member
    const memberQuery = `
      SELECT id, role FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);
    
    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to post messages' });
    }

    // Require at least two members before starting team conversation
    const teamSizeQuery = `
      SELECT COUNT(*)::int AS total_members
      FROM workgroup_members
      WHERE workgroup_id = $1
    `;
    const teamSizeResult = await db.query(teamSizeQuery, [id]);
    const totalMembers = teamSizeResult.rows[0]?.total_members || 0;
    if (totalMembers < 2) {
      return res.status(400).json({
        error: 'Add at least one team member before starting conversation'
      });
    }
    
    // Check if channel exists and is broadcast
    if (channel_id) {
      const channelQuery = `SELECT is_broadcast FROM workgroup_channels WHERE id = $1`;
      const channelResult = await db.query(channelQuery, [channel_id]);
      if (channelResult.rows.length > 0 && channelResult.rows[0].is_broadcast) {
        if (!['owner', 'admin'].includes(memberResult.rows[0].role)) {
          return res.status(403).json({ error: 'Only admins can post in broadcast channels' });
        }
      }
    }
    
    const { files, mentions } = req.body;
    const attachments = Array.isArray(files) ? files : [];
    const messageMentions = Array.isArray(mentions) ? mentions : [];

    const postId = uuidv4();
    const insertQuery = `
      INSERT INTO workgroup_posts (
        id, workgroup_id, channel_id, user_id, parent_id, content, content_type, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *
    `;
    
    const result = await db.query(insertQuery, [
      postId,
      id,
      channel_id || null,
      req.user.id,
      parent_id || null,
      content.trim(),
      content_type || 'text',
      JSON.stringify(attachments)
    ]);
    
    // Get post with author info
    const postQuery = `
      SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar
      FROM workgroup_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;
    const postResult = await db.query(postQuery, [postId]);
    
    // Log activity
    await logActivity(id, req.user.id, 'message_posted', {
      message_id: postId,
      is_reply: !!parent_id
    });
    
    const insertedPost = postResult.rows[0];

    // Real-time: broadcast to everyone subscribed to this workgroup room
    realtimeService.emitWorkgroupPost(id, insertedPost);

    // Fetch workgroup name and all members (excluding sender) for per-user notifications
    const [wgResult, membersResult] = await Promise.all([
      db.query(`SELECT name, type, settings FROM workgroups WHERE id = $1`, [id]),
      db.query(
        `SELECT wm.user_id FROM workgroup_members wm WHERE wm.workgroup_id = $1 AND wm.user_id <> $2`,
        [id, req.user.id]
      ),
    ]);

    const workgroup = wgResult.rows[0];
    const isDirectChat = workgroup?.settings?.is_direct_chat === true || workgroup?.settings?.is_direct_chat === 'true';
    const chatName = isDirectChat ? insertedPost.author_name : (workgroup?.name || 'Team');
    const notifTitle = isDirectChat ? insertedPost.author_name : `${chatName}`;
    const notifBody = insertedPost.content.replace('[SYSTEM] ', '');
    const notifPayload = {
      title: notifTitle,
      body: notifBody,
      workgroup_id: id,
      workgroup_name: chatName,
      user_id: req.user.id,
      author_name: insertedPost.author_name,
      author_avatar: insertedPost.author_avatar,
      post_id: insertedPost.id,
      is_direct_chat: isDirectChat,
    };

    for (const { user_id } of membersResult.rows) {
      // Per-user socket notification (reaches connected clients on any page)
      realtimeService.emitWorkgroupNotification(user_id, notifPayload);
      // Web push for closed/background tabs
      pushService.sendPushToUser(user_id, {
        type: 'workgroup_message',
        ...notifPayload,
      });
    }

    // Send Mention Events
    for (const mentionedUser of messageMentions) {
        realtimeService.emitMention(mentionedUser, {
            type: 'workgroup_post',
            workgroupId: id,
            message: insertedPost
        });
    }

    res.status(201).json(insertedPost);
  } catch (err) {
    next(err);
  }
};

// Delete workgroup post
const deleteWorkgroupPost = async (req, res, next) => {
  try {
    const { id, postId } = req.params;
    
    // Check if post exists and get post info
    const postQuery = `
      SELECT p.*, wm.role
      FROM workgroup_posts p
      LEFT JOIN workgroup_members wm ON p.workgroup_id = wm.workgroup_id AND wm.user_id = $1
      WHERE p.id = $2 AND p.workgroup_id = $3 AND p.is_deleted = false
    `;
    const postResult = await db.query(postQuery, [req.user.id, postId, id]);
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = postResult.rows[0];
    
    // Check permissions: author can delete their own posts, admins/owners can delete any post
    if (post.user_id !== req.user.id && !['owner', 'admin'].includes(post.role)) {
      return res.status(403).json({ error: 'You can only delete your own posts or be an admin' });
    }
    
    // Soft delete the post
    const deleteQuery = `
      UPDATE workgroup_posts 
      SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await db.query(deleteQuery, [postId]);
    
    // Log activity
    await logActivity(id, req.user.id, 'message_deleted', {
      message_id: postId,
      deleted_by_author: post.user_id === req.user.id
    });
    
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Delete workgroup post only for current user
const deleteWorkgroupPostForMe = async (req, res, next) => {
  try {
    const { id, postId } = req.params;

    // Ensure requester is a member and post exists in this workgroup
    const postQuery = `
      SELECT p.id, p.user_id
      FROM workgroup_posts p
      JOIN workgroup_members wm
        ON wm.workgroup_id = p.workgroup_id
       AND wm.user_id = $1
      WHERE p.id = $2
        AND p.workgroup_id = $3
        AND p.is_deleted = false
    `;
    const postResult = await db.query(postQuery, [req.user.id, postId, id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await db.query(
      `
        UPDATE workgroup_posts
        SET deleted_for_users = CASE
          WHEN deleted_for_users IS NULL THEN ARRAY[$1::uuid]
          WHEN $1::uuid = ANY(deleted_for_users) THEN deleted_for_users
          ELSE array_append(deleted_for_users, $1::uuid)
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND workgroup_id = $3
      `,
      [req.user.id, postId, id],
    );

    res.json({ message: 'Post deleted for you' });
  } catch (err) {
    next(err);
  }
};

// Toggle pin status of workgroup post
const togglePinWorkgroupPost = async (req, res, next) => {
  try {
    const { id, postId } = req.params;
    const { is_pinned } = req.body;
    
    // Check if user is admin/owner
    const memberQuery = `
      SELECT role FROM workgroup_members 
      WHERE workgroup_id = $1 AND user_id = $2
    `;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);
    
    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to pin posts' });
    }
    
    if (!['owner', 'admin'].includes(memberResult.rows[0].role)) {
      return res.status(403).json({ error: 'Only admins and owners can pin posts' });
    }
    
    // Check if post exists
    const postQuery = `
      SELECT * FROM workgroup_posts 
      WHERE id = $1 AND workgroup_id = $2 AND is_deleted = false
    `;
    const postResult = await db.query(postQuery, [postId, id]);
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Update pin status
    const updateQuery = `
      UPDATE workgroup_posts 
      SET is_pinned = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(updateQuery, [is_pinned, postId]);
    
    // Log activity
    await logActivity(id, req.user.id, is_pinned ? 'message_pinned' : 'message_unpinned', {
      message_id: postId
    });
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Add reaction to a post
const addWorkgroupPostReaction = async (req, res, next) => {
  try {
    const { id, postId } = req.params;
    const { reaction } = req.body;
    
    // Check if user is member
    const memberQuery = `SELECT id FROM workgroup_members WHERE workgroup_id = $1 AND user_id = $2`;
    const memberResult = await db.query(memberQuery, [id, req.user.id]);
    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a member to react' });
    }

    const fetchQ = `SELECT reactions FROM workgroup_posts WHERE id = $1 AND workgroup_id = $2 AND is_deleted = false`;
    const fetchResult = await db.query(fetchQ, [postId, id]);
    if (fetchResult.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    
    const currentReactions = fetchResult.rows[0].reactions || {};
    if (!currentReactions[reaction]) currentReactions[reaction] = [];
    if (!currentReactions[reaction].includes(req.user.id)) {
        currentReactions[reaction].push(req.user.id);
    } else {
        currentReactions[reaction] = currentReactions[reaction].filter(uId => uId !== req.user.id);
        if (currentReactions[reaction].length === 0) delete currentReactions[reaction];
    }

    const updateQ = `UPDATE workgroup_posts SET reactions = $1 WHERE id = $2 RETURNING *`;
    const updatedRows = await db.query(updateQ, [JSON.stringify(currentReactions), postId]);

    realtimeService.emitReactionAdded(`workgroup:${id}`, { messageId: postId, reactions: currentReactions });
    
    res.json(updatedRows.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Find existing direct chat or create one
const getOrCreateDirectChatWorkgroup = async (req, res, next) => {
  let client = null;
  try {
    const { contact_user_id } = req.body;
    if (!contact_user_id) {
      return res.status(400).json({ error: 'contact_user_id is required' });
    }

    const currentUserId = String(req.user.id || '').toLowerCase();
    const contactUserId = String(contact_user_id || '').toLowerCase();
    if (contactUserId === currentUserId) {
      return res.status(400).json({ error: 'Cannot open direct chat with yourself' });
    }

    const contactResult = await db.query(
      `SELECT id, full_name, email FROM users WHERE id = $1 AND org_id = $2`,
      [contact_user_id, req.user.orgId]
    );
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    const existingResult = await db.query(
      `
        SELECT w.*
        FROM workgroups w
        JOIN workgroup_members wm_me ON wm_me.workgroup_id = w.id AND wm_me.user_id = $1
        JOIN workgroup_members wm_contact ON wm_contact.workgroup_id = w.id AND wm_contact.user_id = $2
        WHERE w.org_id = $3
          AND w.type = 'private'
          AND w.is_archived = false
          AND COALESCE((w.settings->>'is_direct_chat')::boolean, false) = true
        LIMIT 1
      `,
      [req.user.id, contact_user_id, req.user.orgId]
    );
    if (existingResult.rows.length > 0) {
      return res.json(existingResult.rows[0]);
    }

    const contact = contactResult.rows[0];
    const directChatName = contact.full_name || contact.email || 'Direct Chat';
    const pairKey = [currentUserId, contactUserId].sort().join(':');

    client = await db.pool.connect();
    await client.query('BEGIN');
    const workgroupId = uuidv4();
    const createdResult = await client.query(
      `
        INSERT INTO workgroups (id, org_id, name, type, is_private, created_by, settings)
        VALUES ($1, $2, $3, 'private', true, $4, $5::jsonb)
        RETURNING *
      `,
      [
        workgroupId,
        req.user.orgId,
        directChatName,
        req.user.id,
        JSON.stringify({ is_direct_chat: true, direct_pair_key: pairKey }),
      ]
    );

    await client.query(
      `
        INSERT INTO workgroup_members (workgroup_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (workgroup_id, user_id) DO NOTHING
      `,
      [workgroupId, req.user.id]
    );
    await client.query(
      `
        INSERT INTO workgroup_members (workgroup_id, user_id, role)
        SELECT $1::uuid, $2::uuid, 'member'
        WHERE $2::uuid <> $3::uuid
        ON CONFLICT (workgroup_id, user_id) DO NOTHING
      `,
      [workgroupId, contact_user_id, req.user.id]
    );

    await client.query('COMMIT');
    client.release();
    client = null;
    res.status(201).json(createdResult.rows[0]);
  } catch (err) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch (_) {}
    if (client) client.release();
    next(err);
  }
};

// Helper function to log activities
const logActivity = async (workgroupId, userId, activityType, activityData = {}) => {
  try {
    const query = `
      INSERT INTO workgroup_activities (workgroup_id, user_id, activity_type, activity_data)
      VALUES ($1, $2, $3, $4)
    `;
    await db.query(query, [workgroupId, userId, activityType, activityData]);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

// Get workgroup activities
const getWorkgroupActivities = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const query = `
      SELECT 
        wa.*,
        u.full_name as user_name,
        u.avatar_url as user_avatar
      FROM workgroup_activities wa
      LEFT JOIN users u ON wa.user_id = u.id
      WHERE wa.workgroup_id = $1
      ORDER BY wa.created_at DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [id, parseInt(limit)]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWorkgroups,
  getWorkgroup,
  createWorkgroup,
  updateWorkgroup,
  deleteWorkgroup,
  getWorkgroupMembers,
  addWorkgroupMember,
  removeWorkgroupMember,
  getWorkgroupPosts,
  createWorkgroupPost,
  deleteWorkgroupPost,
  deleteWorkgroupPostForMe,
  togglePinWorkgroupPost,
  addWorkgroupPostReaction,
  getOrCreateDirectChatWorkgroup,
  getWorkgroupActivities
};
