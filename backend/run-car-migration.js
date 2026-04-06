const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('\n🚗 INSTALLING CAR INVENTORY SYSTEM...\n');
console.log('='.repeat(70));

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const migrationFile = path.join(__dirname, 'src', 'database', 'migrations', 'add-car-inventory.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('❌ Migration file not found!');
      process.exit(1);
    }

    console.log('📄 Reading migration file...');
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('🔄 Executing migration...\n');
    
    // Execute the entire migration
    await pool.query(sqlContent);
    
    // Get first org_id
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    if (orgResult.rows.length === 0) {
      console.log('⚠️  No organization found. Skipping workspace creation.');
    } else {
      const orgId = orgResult.rows[0].id;
      console.log(`📋 Using organization ID: ${orgId}`);
      
      // Create default workspaces
      console.log('🏢 Creating default workspaces...');
      await pool.query(`
        INSERT INTO car_workspaces (org_id, name, description, workspace_type, is_active) VALUES
        ($1, 'Biwords Auto', 'Main dealership for Biwords', 'dealership', true),
        ($1, 'Motors 1', 'First motors branch', 'branch', true),
        ($1, 'Motors 2', 'Second motors branch', 'branch', true),
        ($1, 'Motors 3', 'Third motors branch', 'branch', true)
      `, [orgId]);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ CAR INVENTORY SYSTEM INSTALLED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'car_%'
      ORDER BY table_name
    `);
    
    console.log(`\n📊 Created ${result.rows.length} tables:`);
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check workspaces
    const workspaces = await pool.query('SELECT name FROM car_workspaces ORDER BY created_at');
    console.log(`\n🏢 Created ${workspaces.rows.length} default workspaces:`);
    workspaces.rows.forEach(ws => {
      console.log(`   ✅ ${ws.name}`);
    });
    
    console.log('\n📡 API Endpoints available:');
    console.log('   • GET/POST /api/car-workspaces');
    console.log('   • GET/POST /api/car-inventory');
    console.log('   • GET/POST /api/car-inquiries');
    
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your server: npm run dev');
    console.log('   2. Test endpoints with Postman/Thunder Client');
    console.log('   3. Read CAR_INVENTORY_SETUP.md for full documentation\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
