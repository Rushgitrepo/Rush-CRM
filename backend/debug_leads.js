const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const orgId = 'e8fac0b6-1997-443d-b8fe-72aeb309973d';
  try {
    // 1. Check leads table schema
    const schema = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' ORDER BY ordinal_position");
    console.log('=== LEADS TABLE SCHEMA ===');
    console.table(schema.rows);

    // 2. Check recently added Instantly leads
    const leads = await pool.query("SELECT id, title, first_name, last_name, email, company_name, company, source, status, stage, organization_id, org_id, created_at FROM leads WHERE source = 'Instantly' AND organization_id = $1 ORDER BY created_at DESC LIMIT 5", [orgId]);
    console.log('=== INSTANTLY LEADS (org_id match) ===');
    console.table(leads.rows);
    console.log('Count:', leads.rowCount);
  } catch (err) {
    console.error('Error:', err.message);
    // Try alternate column names
    try {
      const leads2 = await pool.query("SELECT * FROM leads WHERE source = 'Instantly' ORDER BY created_at DESC LIMIT 3");
      console.log('=== ALL INSTANTLY LEADS (any org) ===');
      console.log(JSON.stringify(leads2.rows[0], null, 2));
    } catch (e2) {
      console.error('Error2:', e2.message);
    }
  } finally {
    await pool.end();
  }
}

check();
