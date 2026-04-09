const db = require('../../config/database');
const Joi = require('joi');

// Validation Schemas
const createRequisitionSchema = Joi.object({
  position: Joi.string().required(),
  department: Joi.string().required(),
  numberOfPositions: Joi.number().integer().min(1).required(),
  jobDescription: Joi.string().required(),
  requirements: Joi.string().optional().allow(''),
  requestType: Joi.string().valid('single', 'team', 'other').default('single'),
  urgency: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  grade: Joi.string().optional().allow('')
});

// Generate unique requisition ID
const generateRequisitionId = async () => {
  const year = new Date().getFullYear();
  const result = await db.query(
    `SELECT COUNT(*) as count FROM job_requisitions WHERE requisition_id LIKE $1`,
    [`REQ-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `REQ-${year}-${String(count).padStart(3, '0')}`;
};

// Create Requisition
exports.createRequisition = async (req, res) => {
  try {
    const { error, value } = createRequisitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const requisitionId = await generateRequisitionId();
    const userId = req.user.id;
    const organizationId = req.user.orgId;

    // Get user details
    const userResult = await db.query(
      'SELECT full_name, email FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    const userName = user.full_name;

    // Insert requisition
    const result = await db.query(
      `INSERT INTO job_requisitions (
        requisition_id, position, department, number_of_positions,
        job_description, requirements, request_type, urgency, grade,
        requested_by, requested_by_name, requested_by_email, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        requisitionId, value.position, value.department, value.numberOfPositions,
        value.jobDescription, value.requirements, value.requestType, value.urgency,
        value.grade, userId, userName, user.email, organizationId
      ]
    );

    const requisition = result.rows[0];

    // Create approval workflow steps
    const approvalSteps = [
      { step: 1, role: 'Requester', status: 'completed', action: 'submitted', approver_id: userId, approver_name: userName, approver_email: user.email },
      { step: 2, role: 'Department Head', status: 'pending', action: 'pending_review' },
      { step: 3, role: 'HR Manager', status: 'not_started', action: 'awaiting' },
      { step: 4, role: 'Higher Authority', status: 'not_started', action: 'awaiting' }
    ];

    for (const step of approvalSteps) {
      await db.query(
        `INSERT INTO requisition_approvals (
          requisition_id, step_number, role, status, action,
          approver_id, approver_name, approver_email, action_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          requisition.id, step.step, step.role, step.status, step.action,
          step.approver_id || null, step.approver_name || null, step.approver_email || null,
          step.status === 'completed' ? new Date() : null
        ]
      );
    }

    res.status(201).json({
      message: 'Requisition created successfully',
      requisition
    });
  } catch (error) {
    console.error('Error creating requisition:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  }
};

// Get All Requisitions
exports.getRequisitions = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { status, department, search } = req.query;

    let query = `
      SELECT r.*, 
        (SELECT COUNT(*) FROM candidates WHERE requisition_id = r.id) as candidate_count
      FROM job_requisitions r
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Only filter by organization if it exists
    if (organizationId) {
      paramCount++;
      query += ` AND r.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    if (status) {
      paramCount++;
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
    }

    if (department) {
      paramCount++;
      query += ` AND r.department = $${paramCount}`;
      params.push(department);
    }

    if (search) {
      paramCount++;
      query += ` AND (r.position ILIKE $${paramCount} OR r.requisition_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
};

// Get Requisition by ID
exports.getRequisitionById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    let query = `
      SELECT r.*, 
        (SELECT COUNT(*) FROM candidates WHERE requisition_id = r.id) as candidate_count
      FROM job_requisitions r
      WHERE r.id = $1
    `;
    const params = [id];

    // Only filter by organization if it exists
    if (organizationId) {
      query += ` AND r.organization_id = $2`;
      params.push(organizationId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    // Get approval workflow
    const approvalResult = await db.query(
      `SELECT * FROM requisition_approvals 
       WHERE requisition_id = $1 
       ORDER BY step_number`,
      [id]
    );

    const requisition = result.rows[0];
    requisition.approvalWorkflow = approvalResult.rows;

    res.json(requisition);
  } catch (error) {
    console.error('Error fetching requisition:', error);
    res.status(500).json({ error: 'Failed to fetch requisition' });
  }
};

// Approve/Reject Requisition
exports.updateRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body; // action: 'approve' or 'reject'
    const userId = req.user.id;
    const organizationId = req.user.orgId;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Get user details
    const userResult = await db.query(
      'SELECT full_name, email FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    const userName = user.full_name;

    // Get current requisition
    let query = 'SELECT * FROM job_requisitions WHERE id = $1';
    const params = [id];
    
    if (organizationId) {
      query += ' AND organization_id = $2';
      params.push(organizationId);
    }
    
    const reqResult = await db.query(query, params);

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    const requisition = reqResult.rows[0];

    // Get current pending approval step
    const approvalResult = await db.query(
      `SELECT * FROM requisition_approvals 
       WHERE requisition_id = $1 AND status = 'pending' 
       ORDER BY step_number LIMIT 1`,
      [id]
    );

    if (approvalResult.rows.length === 0) {
      return res.status(400).json({ error: 'No pending approval found' });
    }

    const currentStep = approvalResult.rows[0];

    // Update current step
    await db.query(
      `UPDATE requisition_approvals 
       SET status = $1, action = $2, comments = $3, 
           approver_id = $4, approver_name = $5, approver_email = $6, action_date = NOW()
       WHERE id = $7`,
      [
        action === 'approve' ? 'completed' : 'rejected',
        action === 'approve' ? 'approved' : 'rejected',
        comments,
        userId,
        userName,
        user.email,
        currentStep.id
      ]
    );

    let newStatus = requisition.status;

    if (action === 'reject') {
      newStatus = 'rejected';
    } else {
      // Move to next step
      const nextStepResult = await db.query(
        `SELECT * FROM requisition_approvals 
         WHERE requisition_id = $1 AND step_number > $2 
         ORDER BY step_number LIMIT 1`,
        [id, currentStep.step_number]
      );

      if (nextStepResult.rows.length > 0) {
        // Update next step to pending
        await db.query(
          'UPDATE requisition_approvals SET status = $1 WHERE id = $2',
          ['pending', nextStepResult.rows[0].id]
        );

        // Update requisition status based on next step
        const nextStep = nextStepResult.rows[0];
        if (nextStep.role === 'HR Manager') {
          newStatus = 'pending_hr';
        } else if (nextStep.role === 'Higher Authority') {
          newStatus = 'pending_management';
        }
      } else {
        // All approvals complete
        newStatus = 'approved';
      }
    }

    // Update requisition status
    await db.query(
      'UPDATE job_requisitions SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, id]
    );

    res.json({
      message: `Requisition ${action}d successfully`,
      status: newStatus
    });
  } catch (error) {
    console.error('Error updating requisition status:', error);
    res.status(500).json({ error: 'Failed to update requisition status' });
  }
};

// Get Pending Approvals for Current User
exports.getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.orgId;
    const userRole = req.user.role; // Assuming role is available

    // Map user role to approval role
    let approvalRole;
    if (userRole === 'department_head') {
      approvalRole = 'Department Head';
    } else if (userRole === 'hr_manager') {
      approvalRole = 'HR Manager';
    } else if (userRole === 'ceo' || userRole === 'admin') {
      approvalRole = 'Higher Authority';
    }

    // For admin/testing, show all pending approvals
    // In production, you would filter by approvalRole
    let query = `
      SELECT r.*, a.step_number, a.role as current_step
      FROM job_requisitions r
      JOIN requisition_approvals a ON r.id = a.requisition_id
      WHERE a.status = 'pending'
    `;
    const params = [];
    let paramCount = 0;

    // If user has a specific approval role, filter by it
    if (approvalRole && userRole !== 'admin') {
      paramCount++;
      query += ` AND a.role = $${paramCount}`;
      params.push(approvalRole);
    }

    if (organizationId) {
      paramCount++;
      query += ` AND r.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
};

// Delete Requisition
exports.deleteRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    let query = 'DELETE FROM job_requisitions WHERE id = $1';
    const params = [id];

    if (organizationId) {
      query += ' AND organization_id = $2';
      params.push(organizationId);
    }

    query += ' RETURNING *';

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Requisition not found' });
    }

    res.json({ message: 'Requisition deleted successfully' });
  } catch (error) {
    console.error('Error deleting requisition:', error);
    res.status(500).json({ error: 'Failed to delete requisition' });
  }
};

