const db = require('../config/database');

const sql = `
-- =========================
-- Calendar Events
-- =========================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  color VARCHAR(50) DEFAULT '#3b82f6',
  external_calendar_id VARCHAR(255),
  external_provider VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Calendar Connections
-- =========================
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  calendar_name VARCHAR(255),
  external_calendar_id VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  is_primary BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT calendar_connections_unique_user_provider 
    UNIQUE(org_id, user_id, provider)
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_calendar_events_org 
ON calendar_events(org_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_time 
ON calendar_events(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_org 
ON calendar_connections(org_id);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user 
ON calendar_connections(user_id);
`;

async function run() {
  try {
    console.log('Creating calendar tables...');
    await db.query(sql);
    console.log('✅ Calendar tables created successfully (or already exist)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create calendar tables:', err);
    process.exit(1);
  }
}

run();