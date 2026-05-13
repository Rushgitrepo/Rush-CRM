const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(workspace_id) as with_workspace,
        COUNT(*) FILTER (WHERE workspace_id IS NULL) as without_workspace
      FROM leads 
      WHERE source = 'Instantly'
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
    
    const res2 = await pool.query(`SELECT id, name FROM workgroups`);
    console.log('\nWorkgroups:');
    console.table(res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
