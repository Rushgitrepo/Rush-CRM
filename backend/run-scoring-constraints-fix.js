const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

async function runMigration() {
  try {
    console.log('🔧 Fixing scoring table constraints...\n');

    const migrationPath = path.join(__dirname, 'src/database/migrations/20260409_fix_scoring_constraints.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Running migration: 20260409_fix_scoring_constraints.sql');
    await db.query(migrationSQL);
    console.log('✅ Migration completed successfully!\n');

    console.log('🎉 Scoring constraints fixed!');
    console.log('   - candidate_scores: UNIQUE(candidate_id, criteria_id, scored_by)');
    console.log('   - candidate_rankings: UNIQUE(candidate_id, requisition_id)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
