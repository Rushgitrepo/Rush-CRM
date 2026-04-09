const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function verifyAndAddColumns() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking existing columns in candidates table...');
    
    // Check existing columns
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'candidates'
      ORDER BY ordinal_position;
    `);
    
    console.log('Existing columns:', result.rows.map(r => r.column_name).join(', '));
    
    const existingColumns = result.rows.map(r => r.column_name);
    const requiredColumns = [
      'form_token',
      'form_token_expires_at',
      'father_name',
      'father_occupation',
      'mobile_no',
      'blood_group',
      'number_of_children',
      'residence_type',
      'academic_records',
      'work_experience',
      'joining_availability'
    ];
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ All columns already exist!');
      return;
    }
    
    console.log('❌ Missing columns:', missingColumns.join(', '));
    console.log('🔄 Adding missing columns...');
    
    // Add each column individually
    for (const column of missingColumns) {
      try {
        let sql = '';
        switch(column) {
          case 'form_token':
            sql = 'ALTER TABLE candidates ADD COLUMN form_token VARCHAR(255)';
            break;
          case 'form_token_expires_at':
            sql = 'ALTER TABLE candidates ADD COLUMN form_token_expires_at TIMESTAMP';
            break;
          case 'father_name':
            sql = 'ALTER TABLE candidates ADD COLUMN father_name VARCHAR(255)';
            break;
          case 'father_occupation':
            sql = 'ALTER TABLE candidates ADD COLUMN father_occupation VARCHAR(255)';
            break;
          case 'mobile_no':
            sql = 'ALTER TABLE candidates ADD COLUMN mobile_no VARCHAR(50)';
            break;
          case 'blood_group':
            sql = 'ALTER TABLE candidates ADD COLUMN blood_group VARCHAR(10)';
            break;
          case 'number_of_children':
            sql = 'ALTER TABLE candidates ADD COLUMN number_of_children INTEGER DEFAULT 0';
            break;
          case 'residence_type':
            sql = 'ALTER TABLE candidates ADD COLUMN residence_type VARCHAR(50)';
            break;
          case 'academic_records':
            sql = 'ALTER TABLE candidates ADD COLUMN academic_records JSONB';
            break;
          case 'work_experience':
            sql = 'ALTER TABLE candidates ADD COLUMN work_experience JSONB';
            break;
          case 'joining_availability':
            sql = 'ALTER TABLE candidates ADD COLUMN joining_availability VARCHAR(255)';
            break;
        }
        
        if (sql) {
          await client.query(sql);
          console.log(`  ✅ Added: ${column}`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to add ${column}:`, err.message);
      }
    }
    
    // Create index
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_candidates_form_token ON candidates(form_token)');
      console.log('  ✅ Created index on form_token');
    } catch (err) {
      console.log('  ⚠️  Index already exists or failed:', err.message);
    }
    
    console.log('\n✅ Migration completed!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyAndAddColumns();
