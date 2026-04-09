const { Pool } = require('pg');
require('dotenv').config();

async function listTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(JSON.stringify(result.rows.map(r => r.table_name)));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listTables();
