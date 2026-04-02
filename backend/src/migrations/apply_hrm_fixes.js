const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const queries = [
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS code VARCHAR(20)',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS description TEXT',
    "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#3B82F6'",
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_consecutive_days INTEGER',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS min_days_notice INTEGER DEFAULT 0',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT true',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS can_carry_forward BOOLEAN DEFAULT false',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_carry_forward_days INTEGER DEFAULT 0',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS expires_after_months INTEGER',
    "ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS applicable_to VARCHAR(20) DEFAULT 'all'",
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS min_service_months INTEGER DEFAULT 0',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true',
    'ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'CREATE TABLE IF NOT EXISTS employee_leave_balances (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE, leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE, org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, year INTEGER NOT NULL, total_allocated DECIMAL(5,2) NOT NULL DEFAULT 0, used DECIMAL(5,2) NOT NULL DEFAULT 0, pending DECIMAL(5,2) NOT NULL DEFAULT 0, available DECIMAL(5,2) GENERATED ALWAYS AS (total_allocated - used - pending) STORED, carried_forward DECIMAL(5,2) DEFAULT 0, expires_on DATE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(employee_id, leave_type_id, year))',
    'CREATE TABLE IF NOT EXISTS leave_request_comments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id), comment TEXT NOT NULL, action VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS public_holidays (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, date DATE NOT NULL, is_optional BOOLEAN DEFAULT false, description TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(org_id, date))'
  ];

  try {
    for (const q of queries) {
      await pool.query(q);
    }
    console.log('Successfully updated leave tables/columns');
  } catch (err) {
    console.error('Update failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
