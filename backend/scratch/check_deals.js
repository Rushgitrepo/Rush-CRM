const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDeals() {
  const res = await pool.query('SELECT id, title, custom_fields FROM public.deals ORDER BY created_at DESC LIMIT 5');
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

checkDeals().catch(console.error);
