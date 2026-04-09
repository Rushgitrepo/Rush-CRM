const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running form token migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/20260409_add_form_token_to_candidates.sql'), 
      'utf8'
    );

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 100) + '...');
        await client.query(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('📋 Added columns:');
    console.log('   - form_token');
    console.log('   - form_token_expires_at');
    console.log('   - father_name');
    console.log('   - father_occupation');
    console.log('   - mobile_no');
    console.log('   - blood_group');
    console.log('   - number_of_children');
    console.log('   - residence_type');
    console.log('   - academic_records');
    console.log('   - work_experience');
    console.log('   - joining_availability');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
