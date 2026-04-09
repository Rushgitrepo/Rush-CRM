-- Advanced Recruitment Features Migration
-- Migration: 20260409_add_advanced_recruitment_features.sql
-- Adds: Offer Management, Candidate Scoring, Talent Pool, Job Templates, Background Verification

-- =====================================================
-- 1. OFFER MANAGEMENT SYSTEM
-- =====================================================

-- Job Offers Table
CREATE TABLE IF NOT EXISTS job_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    offer_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Position Details
    position VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    grade VARCHAR(50),
    reporting_manager VARCHAR(255),
    work_location VARCHAR(255),
    employment_type VARCHAR(50) DEFAULT 'full_time', -- full_time, part_time, contract, internship
    
    -- Compensation Package
    base_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'PKR',
    salary_frequency VARCHAR(20) DEFAULT 'monthly', -- monthly, annual
    bonus_percentage DECIMAL(5,2),
    allowances JSONB, -- {housing: 50000, transport: 15000, medical: 25000}
    benefits TEXT,
    
    -- Offer Terms
    start_date DATE NOT NULL,
    probation_period INTEGER DEFAULT 90, -- days
    notice_period INTEGER DEFAULT 30, -- days
    working_hours VARCHAR(50) DEFAULT '9 AM - 6 PM',
    
    -- Offer Status & Timeline
    status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, sent, accepted, rejected, withdrawn, expired
    offer_sent_date TIMESTAMP,
    response_deadline DATE,
    accepted_date TIMESTAMP,
    rejected_date TIMESTAMP,
    rejection_reason TEXT,
    
    -- Approval Workflow
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMP,
    
    -- Additional Terms
    special_conditions TEXT,
    offer_letter_template TEXT,
    offer_letter_url TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Offer Approval Workflow
CREATE TABLE IF NOT EXISTS offer_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID REFERENCES job_offers(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_role VARCHAR(100) NOT NULL, -- HR Manager, Department Head, Finance, CEO
    approver_id UUID REFERENCES users(id),
    approver_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    comments TEXT,
    action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(offer_id, step_number)
);

-- =====================================================
-- 2. CANDIDATE SCORING & RANKING SYSTEM
-- =====================================================

-- Scoring Criteria Templates
CREATE TABLE IF NOT EXISTS scoring_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criteria_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- technical, behavioral, experience, education
    description TEXT,
    max_score INTEGER DEFAULT 100,
    weight_percentage DECIMAL(5,2) DEFAULT 100.00,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Candidate Scores
CREATE TABLE IF NOT EXISTS candidate_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    criteria_id UUID REFERENCES scoring_criteria(id),
    interview_id UUID REFERENCES candidate_interviews(id),
    
    -- Scoring Details
    raw_score INTEGER CHECK (raw_score >= 0 AND raw_score <= 100),
    weighted_score DECIMAL(8,2),
    comments TEXT,
    
    -- Scorer Information
    scored_by UUID REFERENCES users(id),
    scorer_name VARCHAR(255),
    scorer_role VARCHAR(100),
    
    -- Metadata
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint for ON CONFLICT
    UNIQUE(candidate_id, criteria_id, scored_by)
);

-- Overall Candidate Rankings
CREATE TABLE IF NOT EXISTS candidate_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    
    -- Ranking Details
    total_score DECIMAL(8,2),
    rank_position INTEGER,
    percentile DECIMAL(5,2),
    
    -- Score Breakdown
    technical_score DECIMAL(8,2),
    behavioral_score DECIMAL(8,2),
    experience_score DECIMAL(8,2),
    education_score DECIMAL(8,2),
    
    -- Ranking Status
    is_current BOOLEAN DEFAULT true,
    ranking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculated_by UUID REFERENCES users(id),
    
    -- Unique constraint for ON CONFLICT
    UNIQUE(candidate_id, requisition_id)
);

-- =====================================================
-- 3. TALENT POOL MANAGEMENT
-- =====================================================

-- Talent Pools
CREATE TABLE IF NOT EXISTS talent_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_name VARCHAR(255) NOT NULL,
    description TEXT,
    pool_type VARCHAR(50) DEFAULT 'skill_based', -- skill_based, department_based, level_based, custom
    
    -- Pool Criteria
    target_skills TEXT[],
    target_departments TEXT[],
    target_experience_min INTEGER, -- years
    target_experience_max INTEGER, -- years
    target_education_level VARCHAR(100),
    
    -- Pool Management
    created_by UUID REFERENCES users(id),
    managed_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Talent Pool Members
CREATE TABLE IF NOT EXISTS talent_pool_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES talent_pools(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    
    -- Membership Details
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, hired_elsewhere, not_interested
    
    -- Engagement Tracking
    last_contacted DATE,
    contact_frequency VARCHAR(50), -- weekly, monthly, quarterly
    notes TEXT,
    
    -- Performance in Pool
    pool_score DECIMAL(8,2),
    availability_status VARCHAR(50) DEFAULT 'available', -- available, not_available, considering_offers
    
    UNIQUE(pool_id, candidate_id)
);

-- =====================================================
-- 4. JOB TEMPLATES SYSTEM
-- =====================================================

-- Job Description Templates
CREATE TABLE IF NOT EXISTS job_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL,
    template_code VARCHAR(50) UNIQUE NOT NULL,
    
    -- Template Classification
    department VARCHAR(100),
    position_level VARCHAR(50), -- entry, mid, senior, executive
    job_family VARCHAR(100), -- engineering, sales, marketing, hr
    grade VARCHAR(50),
    
    -- Template Content
    job_title_template VARCHAR(255),
    job_description_template TEXT,
    key_responsibilities TEXT,
    required_qualifications TEXT,
    preferred_qualifications TEXT,
    required_skills TEXT[],
    preferred_skills TEXT[],
    
    -- Compensation Guidelines
    salary_range_min DECIMAL(12,2),
    salary_range_max DECIMAL(12,2),
    standard_benefits TEXT,
    
    -- Template Metadata
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    last_used_date TIMESTAMP,
    
    -- Version Control
    version VARCHAR(10) DEFAULT '1.0',
    parent_template_id UUID REFERENCES job_templates(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- =====================================================
-- 5. BACKGROUND VERIFICATION SYSTEM
-- =====================================================

-- Background Check Types
CREATE TABLE IF NOT EXISTS background_check_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type_name VARCHAR(100) NOT NULL,
    check_category VARCHAR(50) NOT NULL, -- education, employment, criminal, reference, identity, credit
    description TEXT,
    is_mandatory BOOLEAN DEFAULT false,
    typical_duration_days INTEGER DEFAULT 7,
    cost_estimate DECIMAL(10,2),
    vendor_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    organization_id UUID REFERENCES organizations(id)
);

-- Background Checks
CREATE TABLE IF NOT EXISTS background_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    check_type_id UUID REFERENCES background_check_types(id),
    
    -- Check Details
    check_reference_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Timeline
    initiated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_completion_date DATE,
    completed_date TIMESTAMP,
    
    -- Results
    result VARCHAR(50), -- clear, concerns_found, failed, inconclusive
    result_details TEXT,
    verification_score INTEGER CHECK (verification_score >= 0 AND verification_score <= 100),
    
    -- Verification Details
    verified_by VARCHAR(255), -- External agency or internal team
    verification_method VARCHAR(100),
    documents_verified TEXT[],
    
    -- Cost & Vendor
    cost_incurred DECIMAL(10,2),
    vendor_used VARCHAR(255),
    vendor_reference VARCHAR(100),
    
    -- Internal Tracking
    initiated_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    review_comments TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. ANALYTICS & METRICS TABLES
-- =====================================================

-- Recruitment Metrics
CREATE TABLE IF NOT EXISTS recruitment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(100) NOT NULL, -- time_to_hire, cost_per_hire, source_effectiveness, etc.
    metric_period VARCHAR(50) NOT NULL, -- daily, weekly, monthly, quarterly, yearly
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    
    -- Metric Values
    metric_value DECIMAL(15,4),
    metric_unit VARCHAR(50), -- days, currency, percentage, count
    
    -- Dimensions
    department VARCHAR(100),
    position_level VARCHAR(50),
    requisition_id UUID REFERENCES job_requisitions(id),
    
    -- Metadata
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculated_by UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id)
);

-- Source Effectiveness Tracking
CREATE TABLE IF NOT EXISTS recruitment_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- job_board, social_media, referral, direct, agency
    source_url VARCHAR(500),
    
    -- Effectiveness Metrics
    total_applications INTEGER DEFAULT 0,
    qualified_applications INTEGER DEFAULT 0,
    interviews_scheduled INTEGER DEFAULT 0,
    offers_made INTEGER DEFAULT 0,
    hires_made INTEGER DEFAULT 0,
    
    -- Cost Metrics
    cost_per_application DECIMAL(10,2),
    cost_per_hire DECIMAL(10,2),
    
    -- Performance Metrics
    quality_score DECIMAL(5,2), -- Based on hire success rate
    time_to_fill_avg DECIMAL(8,2), -- Average days
    
    is_active BOOLEAN DEFAULT true,
    organization_id UUID REFERENCES organizations(id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Offer Management Indexes
CREATE INDEX idx_job_offers_candidate ON job_offers(candidate_id);
CREATE INDEX idx_job_offers_status ON job_offers(status);
CREATE INDEX idx_job_offers_created_date ON job_offers(created_at DESC);

-- Scoring System Indexes
CREATE INDEX idx_candidate_scores_candidate ON candidate_scores(candidate_id);
CREATE INDEX idx_candidate_rankings_requisition ON candidate_rankings(requisition_id);
CREATE INDEX idx_candidate_rankings_score ON candidate_rankings(total_score DESC);

-- Talent Pool Indexes
CREATE INDEX idx_talent_pool_members_pool ON talent_pool_members(pool_id);
CREATE INDEX idx_talent_pool_members_candidate ON talent_pool_members(candidate_id);
CREATE INDEX idx_talent_pool_members_status ON talent_pool_members(status);

-- Background Check Indexes
CREATE INDEX idx_background_checks_candidate ON background_checks(candidate_id);
CREATE INDEX idx_background_checks_status ON background_checks(status);
CREATE INDEX idx_background_checks_completion ON background_checks(expected_completion_date);

-- Analytics Indexes
CREATE INDEX idx_recruitment_metrics_type_period ON recruitment_metrics(metric_type, period_start_date);
CREATE INDEX idx_recruitment_sources_effectiveness ON recruitment_sources(quality_score DESC);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE job_offers IS 'Comprehensive offer management with approval workflow';
COMMENT ON TABLE candidate_scores IS 'Multi-criteria candidate scoring system';
COMMENT ON TABLE talent_pools IS 'Talent pool management for future opportunities';
COMMENT ON TABLE job_templates IS 'Standardized job description templates';
COMMENT ON TABLE background_checks IS 'Background verification and compliance tracking';
COMMENT ON TABLE recruitment_metrics IS 'Analytics and KPI tracking for recruitment process';

-- =====================================================
-- DEFAULT DATA SETUP
-- =====================================================

-- Insert Default Scoring Criteria
INSERT INTO scoring_criteria (criteria_name, category, description, max_score, weight_percentage, organization_id) VALUES
('Technical Skills', 'technical', 'Assessment of job-specific technical competencies', 100, 30.00, NULL),
('Communication Skills', 'behavioral', 'Verbal and written communication effectiveness', 100, 20.00, NULL),
('Problem Solving', 'behavioral', 'Analytical thinking and problem resolution abilities', 100, 25.00, NULL),
('Cultural Fit', 'behavioral', 'Alignment with company values and team dynamics', 100, 15.00, NULL),
('Experience Relevance', 'experience', 'Relevance and depth of previous work experience', 100, 10.00, NULL);

-- Insert Default Background Check Types
INSERT INTO background_check_types (check_type_name, check_category, description, is_mandatory, typical_duration_days) VALUES
('Education Verification', 'education', 'Verify educational qualifications and degrees', true, 5),
('Employment History', 'employment', 'Verify previous employment and references', true, 7),
('Identity Verification', 'identity', 'Verify identity documents (CNIC, Passport)', true, 2),
('Reference Check', 'reference', 'Contact and verify professional references', false, 3),
('Criminal Background', 'criminal', 'Check for criminal history and legal issues', false, 10);

-- Insert Default Recruitment Sources
INSERT INTO recruitment_sources (source_name, source_type, source_url) VALUES
('LinkedIn', 'social_media', 'https://linkedin.com'),
('Indeed', 'job_board', 'https://indeed.com'),
('Employee Referral', 'referral', NULL),
('Company Website', 'direct', NULL),
('University Campus', 'direct', NULL),
('Recruitment Agency', 'agency', NULL);