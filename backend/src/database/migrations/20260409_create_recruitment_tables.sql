-- Recruitment Management System Tables
-- Migration: 20260409_create_recruitment_tables.sql

-- 1. Job Requisitions Table
CREATE TABLE IF NOT EXISTS job_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id VARCHAR(50) UNIQUE NOT NULL,
    position VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    number_of_positions INTEGER NOT NULL DEFAULT 1,
    job_description TEXT NOT NULL,
    requirements TEXT,
    request_type VARCHAR(50) DEFAULT 'single', -- single, team, other
    urgency VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    grade VARCHAR(50), -- GD level
    status VARCHAR(50) DEFAULT 'pending_dept_head', -- pending_dept_head, pending_hr, pending_management, approved, rejected, in_advertisement, shortlisting, interviewing, completed
    requested_by UUID REFERENCES users(id),
    requested_by_name VARCHAR(255),
    requested_by_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- 2. Requisition Approval Workflow Table
CREATE TABLE IF NOT EXISTS requisition_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    role VARCHAR(100) NOT NULL, -- Requester, Department Head, HR Manager, Higher Authority
    approver_id UUID REFERENCES users(id),
    approver_name VARCHAR(255),
    approver_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'not_started', -- not_started, pending, completed, rejected
    action VARCHAR(50), -- submitted, approved, rejected, forwarded
    comments TEXT,
    action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requisition_id, step_number)
);

-- 3. Job Advertisements Table
CREATE TABLE IF NOT EXISTS job_advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    benefits TEXT,
    application_deadline DATE,
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, closed
    published_date TIMESTAMP,
    published_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES job_requisitions(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    alternate_phone VARCHAR(50),
    cnic VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(20),
    marital_status VARCHAR(50),
    nationality VARCHAR(100) DEFAULT 'Pakistani',
    religion VARCHAR(50),
    current_address TEXT,
    permanent_address TEXT,
    
    -- Education
    highest_qualification VARCHAR(255),
    university VARCHAR(255),
    graduation_year INTEGER,
    cgpa VARCHAR(20),
    
    -- Experience
    total_experience VARCHAR(100),
    current_company VARCHAR(255),
    current_designation VARCHAR(255),
    current_salary VARCHAR(100),
    expected_salary VARCHAR(100),
    notice_period VARCHAR(100),
    
    -- Position Details
    applied_position VARCHAR(255),
    grade VARCHAR(50),
    department VARCHAR(100),
    
    -- References
    reference1_name VARCHAR(255),
    reference1_contact VARCHAR(100),
    reference1_relation VARCHAR(100),
    reference2_name VARCHAR(255),
    reference2_contact VARCHAR(100),
    reference2_relation VARCHAR(100),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(100),
    emergency_contact_relation VARCHAR(100),
    
    -- CV & Documents
    cv_url TEXT,
    cv_filename VARCHAR(255),
    
    -- Status & Tracking
    status VARCHAR(50) DEFAULT 'cv_received', -- cv_received, shortlisted, interview_scheduled, interviewed, final_round, selected, rejected
    source VARCHAR(100), -- job_board, referral, direct, etc.
    skills TEXT[], -- Array of skills
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- 5. Application Forms Table
CREATE TABLE IF NOT EXISTS candidate_application_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    form_data JSONB NOT NULL, -- Complete form data in JSON format
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, reviewed
    generated_by UUID REFERENCES users(id),
    submitted_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Interviews Table
CREATE TABLE IF NOT EXISTS candidate_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    interview_type VARCHAR(50) NOT NULL, -- technical, hr, final
    interview_date DATE,
    interview_time TIME,
    interviewer_id UUID REFERENCES users(id),
    interviewer_name VARCHAR(255),
    
    -- Evaluation
    technical_skills TEXT,
    communication TEXT,
    problem_solving TEXT,
    culture_fit TEXT,
    overall_remarks TEXT,
    recommendation VARCHAR(50), -- strongly_recommend, recommend, maybe, not_recommend, reject
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Interview Feedback Table (for collaborative hiring)
CREATE TABLE IF NOT EXISTS interview_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES candidate_interviews(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id),
    feedback_by UUID REFERENCES users(id),
    feedback_by_name VARCHAR(255),
    feedback_by_role VARCHAR(100),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    recommendation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Candidate Timeline/Activity Log
CREATE TABLE IF NOT EXISTS candidate_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL, -- application_received, shortlisted, interview_scheduled, interviewed, selected, rejected
    description TEXT,
    performed_by UUID REFERENCES users(id),
    performed_by_name VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX idx_requisitions_status ON job_requisitions(status);
CREATE INDEX idx_requisitions_org ON job_requisitions(organization_id);
CREATE INDEX idx_requisitions_created ON job_requisitions(created_at DESC);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_requisition ON candidates(requisition_id);
CREATE INDEX idx_candidates_org ON candidates(organization_id);
CREATE INDEX idx_interviews_candidate ON candidate_interviews(candidate_id);
CREATE INDEX idx_interviews_date ON candidate_interviews(interview_date);
CREATE INDEX idx_timeline_candidate ON candidate_timeline(candidate_id);
CREATE INDEX idx_approvals_requisition ON requisition_approvals(requisition_id);

-- Add Comments
COMMENT ON TABLE job_requisitions IS 'Stores job requisition requests from departments';
COMMENT ON TABLE requisition_approvals IS 'Tracks approval workflow for requisitions';
COMMENT ON TABLE job_advertisements IS 'Published job advertisements';
COMMENT ON TABLE candidates IS 'Candidate information and applications';
COMMENT ON TABLE candidate_application_forms IS 'Generated application forms for candidates';
COMMENT ON TABLE candidate_interviews IS 'Interview records and evaluations';
COMMENT ON TABLE interview_feedback IS 'Collaborative feedback from multiple interviewers';
COMMENT ON TABLE candidate_timeline IS 'Activity log for candidate journey';
