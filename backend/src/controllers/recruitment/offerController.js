const db = require('../../config/database');
const Joi = require('joi');

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const createOfferSchema = Joi.object({
  candidateId: Joi.string().uuid().required(),
  requisitionId: Joi.string().uuid().required(),
  position: Joi.string().required(),
  department: Joi.string().required(),
  grade: Joi.string().optional(),
  reportingManager: Joi.string().optional(),
  workLocation: Joi.string().required(),
  employmentType: Joi.string().valid('full_time', 'part_time', 'contract', 'internship').default('full_time'),
  
  // Compensation
  baseSalary: Joi.number().positive().required(),
  currency: Joi.string().default('PKR'),
  salaryFrequency: Joi.string().valid('monthly', 'annual').default('monthly'),
  bonusPercentage: Joi.number().min(0).max(100).optional(),
  allowances: Joi.object().optional(),
  benefits: Joi.string().optional(),
  
  // Terms
  startDate: Joi.date().required(),
  probationPeriod: Joi.number().integer().min(0).default(90),
  noticePeriod: Joi.number().integer().min(0).default(30),
  workingHours: Joi.string().default('9 AM - 6 PM'),
  
  // Additional
  specialConditions: Joi.string().optional(),
  responseDeadline: Joi.date().optional()
});

const updateOfferStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'withdrawn', 'expired').required(),
  comments: Joi.string().optional(),
  rejectionReason: Joi.string().optional()
});

// =====================================================
// OFFER MANAGEMENT FUNCTIONS
// =====================================================

// Create Job Offer
exports.createOffer = async (req, res) => {
  try {
    const { error, value } = createOfferSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const organizationId = req.user.orgId;

    // Generate offer number
    const offerCount = await db.query('SELECT COUNT(*) FROM job_offers WHERE organization_id = $1', [organizationId]);
    const offerNumber = `OFF-${new Date().getFullYear()}-${String(parseInt(offerCount.rows[0].count) + 1).padStart(4, '0')}`;

    // Create offer
    const result = await db.query(
      `INSERT INTO job_offers (
        candidate_id, requisition_id, offer_number, position, department, grade,
        reporting_manager, work_location, employment_type, base_salary, currency,
        salary_frequency, bonus_percentage, allowances, benefits, start_date,
        probation_period, notice_period, working_hours, response_deadline,
        special_conditions, created_by, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *`,
      [
        value.candidateId, value.requisitionId, offerNumber, value.position,
        value.department, value.grade, value.reportingManager, value.workLocation,
        value.employmentType, value.baseSalary, value.currency, value.salaryFrequency,
        value.bonusPercentage, JSON.stringify(value.allowances), value.benefits,
        value.startDate, value.probationPeriod, value.noticePeriod, value.workingHours,
        value.responseDeadline, value.specialConditions, userId, organizationId
      ]
    );

    const offer = result.rows[0];

    // Update candidate status
    await db.query(
      'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2',
      ['offer_pending', value.candidateId]
    );

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        value.candidateId,
        'offer_created',
        `Job offer created - ${value.position}`,
        userId,
        req.user.full_name
      ]
    );

    res.status(201).json({
      message: 'Job offer created successfully',
      offer
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create job offer' });
  }
};

// Get All Offers
exports.getAllOffers = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { status, department, candidateId } = req.query;

    let query = `
      SELECT o.*, c.full_name as candidate_name, c.email as candidate_email,
             r.position as requisition_position, r.requisition_id
      FROM job_offers o
      JOIN candidates c ON o.candidate_id = c.id
      JOIN job_requisitions r ON o.requisition_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (organizationId) {
      paramCount++;
      query += ` AND o.organization_id = $${paramCount}`;
      params.push(organizationId);
    }

    if (status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
    }

    if (department) {
      paramCount++;
      query += ` AND o.department = $${paramCount}`;
      params.push(department);
    }

    if (candidateId) {
      paramCount++;
      query += ` AND o.candidate_id = $${paramCount}`;
      params.push(candidateId);
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
};

// Get Offer by ID
exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    let query = `
      SELECT o.*, c.full_name as candidate_name, c.email as candidate_email,
             c.phone as candidate_phone, r.position as requisition_position
      FROM job_offers o
      JOIN candidates c ON o.candidate_id = c.id
      JOIN job_requisitions r ON o.requisition_id = r.id
      WHERE o.id = $1
    `;
    const params = [id];

    if (organizationId) {
      query += ' AND o.organization_id = $2';
      params.push(organizationId);
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = result.rows[0];

    // Get approval workflow
    const approvals = await db.query(
      'SELECT * FROM offer_approvals WHERE offer_id = $1 ORDER BY step_number',
      [id]
    );
    offer.approvals = approvals.rows;

    res.json(offer);
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
};

// Update Offer Status
exports.updateOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateOfferStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const organizationId = req.user.orgId;

    // Get current offer
    const offerResult = await db.query(
      'SELECT * FROM job_offers WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (offerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = offerResult.rows[0];

    // Update offer status
    let updateFields = ['status = $1', 'updated_at = NOW()'];
    let updateParams = [value.status];
    let paramCount = 1;

    if (value.status === 'sent') {
      paramCount++;
      updateFields.push(`offer_sent_date = $${paramCount}`);
      updateParams.push(new Date());
    }

    if (value.status === 'accepted') {
      paramCount++;
      updateFields.push(`accepted_date = $${paramCount}`);
      updateParams.push(new Date());
    }

    if (value.status === 'rejected' && value.rejectionReason) {
      paramCount++;
      updateFields.push(`rejected_date = $${paramCount}`);
      updateParams.push(new Date());
      
      paramCount++;
      updateFields.push(`rejection_reason = $${paramCount}`);
      updateParams.push(value.rejectionReason);
    }

    paramCount++;
    updateParams.push(id);

    const result = await db.query(
      `UPDATE job_offers SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      updateParams
    );

    // Update candidate status based on offer status
    let candidateStatus = offer.candidate_id;
    if (value.status === 'accepted') {
      candidateStatus = 'selected';
    } else if (value.status === 'rejected') {
      candidateStatus = 'offer_rejected';
    }

    if (candidateStatus !== offer.candidate_id) {
      await db.query(
        'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2',
        [candidateStatus, offer.candidate_id]
      );
    }

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        offer.candidate_id,
        `offer_${value.status}`,
        `Offer ${value.status}${value.comments ? ': ' + value.comments : ''}`,
        userId,
        req.user.full_name
      ]
    );

    res.json({
      message: `Offer ${value.status} successfully`,
      offer: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating offer status:', error);
    res.status(500).json({ error: 'Failed to update offer status' });
  }
};

// Send Offer Letter
exports.sendOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const { emailTemplate, customMessage } = req.body;

    // Get offer details
    const offerResult = await db.query(
      `SELECT o.*, c.full_name as candidate_name, c.email as candidate_email
       FROM job_offers o
       JOIN candidates c ON o.candidate_id = c.id
       WHERE o.id = $1`,
      [id]
    );

    if (offerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = offerResult.rows[0];

    // Update offer status to sent
    await db.query(
      'UPDATE job_offers SET status = $1, offer_sent_date = NOW() WHERE id = $2',
      ['sent', id]
    );

    // In a real implementation, you would send the actual email here
    // For now, we'll just log the action

    // Add timeline entry
    await db.query(
      `INSERT INTO candidate_timeline (
        candidate_id, activity_type, description, performed_by, performed_by_name
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        offer.candidate_id,
        'offer_sent',
        `Offer letter sent to ${offer.candidate_email}`,
        req.user.id,
        req.user.full_name
      ]
    );

    res.json({
      message: 'Offer letter sent successfully',
      sentTo: offer.candidate_email,
      sentAt: new Date()
    });
  } catch (error) {
    console.error('Error sending offer letter:', error);
    res.status(500).json({ error: 'Failed to send offer letter' });
  }
};

// Get Offer Statistics
exports.getOfferStats = async (req, res) => {
  try {
    const organizationId = req.user.orgId;

    let orgFilter = '1=1';
    const params = [];
    if (organizationId) {
      orgFilter = 'organization_id = $1';
      params.push(organizationId);
    }

    const stats = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval_count,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
        AVG(base_salary) FILTER (WHERE status = 'accepted') as avg_accepted_salary,
        COUNT(*) FILTER (WHERE offer_sent_date >= CURRENT_DATE - INTERVAL '30 days') as sent_last_30_days
      FROM job_offers
      WHERE ${orgFilter}
    `, params);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching offer stats:', error);
    res.status(500).json({ error: 'Failed to fetch offer statistics' });
  }
};

// Delete Offer
exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.orgId;

    const result = await db.query(
      'DELETE FROM job_offers WHERE id = $1 AND organization_id = $2 RETURNING *',
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
};
