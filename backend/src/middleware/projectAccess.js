const db = require('../config/database');

/**
 * Middleware to check if user has access to a specific project
 */
const checkProjectAccess = async (req, res, next) => {
  try {
    const projectId = req.params.id || req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    // Check if user is project owner or member
    const accessCheck = await db.query(`
      SELECT p.id 
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
      WHERE p.id = $1 AND p.org_id = $3 
      AND (p.owner_id = $2 OR pm.user_id IS NOT NULL)
    `, [projectId, req.user.id, req.user.orgId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    next();
  } catch (error) {
    console.error('Project access check error:', error);
    res.status(500).json({ error: 'Access check failed' });
  }
};

/**
 * Get projects that user has access to (owns or is member of)
 */
const getUserAccessibleProjects = async (userId, orgId, filters = {}) => {
  let query = `
    SELECT DISTINCT p.* 
    FROM projects p
    LEFT JOIN project_members pm ON p.id = pm.project_id
    WHERE p.org_id = $2 
    AND (p.owner_id = $1 OR pm.user_id = $1)
  `;
  
  const params = [userId, orgId];
  let paramIndex = 3;

  // Add filters
  if (filters.status) {
    query += ` AND p.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  query += ` ORDER BY p.created_at DESC`;

  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(filters.limit);
    paramIndex++;
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }
  }

  return { query, params };
};

module.exports = {
  checkProjectAccess,
  getUserAccessibleProjects
};