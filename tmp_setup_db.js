const fs = require('fs');
const path = require('path');

const migrateJsPath = path.join(__dirname, 'backend', 'src', 'database', 'migrate.js');
const databaseSqlPath = path.join(__dirname, 'backend', 'src', 'database', 'database.sql');

let s = fs.readFileSync(migrateJsPath, 'utf8');
const match = s.match(/const migrationSQL = `([\s\S]*?)`;/);

if (match) {
  let sql = match[1];
  const extras = `
-- Missing project relationships
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_org ON project_members(org_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_org ON project_milestones(org_id);
`;

  sql += extras;
  fs.writeFileSync(databaseSqlPath, sql.trim() + '\n');
  s = s.replace(/const migrationSQL = `[\s\S]*?`;/, "const fs = require('fs');\nconst path = require('path');\nconst migrationSQL = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');");
  fs.writeFileSync(migrateJsPath, s);
  console.log('Successfully updated database.sql and migrate.js');
} else {
  console.log('regex mismatch');
}
