const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runRecruitmentMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running recruitment migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src', 'database', 'migrations', '20260409_create_recruitment_tables.sql'),
      'utf8'
    );

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Recruitment tables created successfully!');
    console.log('\nCreated tables:');
    console.log('  - job_requisitions');
    console.log('  - requisition_approvals');
    console.log('  - job_advertisements');
    console.log('  - candidates');
    console.log('  - candidate_application_forms');
    console.log('  - candidate_interviews');
    console.log('  - interview_feedback');
    console.log('  - candidate_timeline');
    console.log('\n✨ Migration completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runRecruitmentMigration();
