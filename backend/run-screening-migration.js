const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

async function runScreeningMigration() {
  try {
    console.log('Starting screening columns migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/20260409_add_screening_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await db.query(migrationSQL);
    
    console.log('✅ Screening columns migration completed successfully!');
    console.log('Added columns:');
    console.log('- screening_notes, screening_date, screened_by, screened_by_name');
    console.log('- interview_date, interview_time, interview_location, interview_type');
    console.log('- Grade-specific form fields (leadership_experience, project_management, etc.)');
    console.log('- Updated status constraints to include screened_passed, screened_failed, form_generated');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit();
  }
}

runScreeningMigration();