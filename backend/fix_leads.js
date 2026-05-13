const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixLeads() {
  const orgId = 'e8fac0b6-1997-443d-b8fe-72aeb309973d'; // Default org for the fix
  try {
    // Ensure "First Engagement" stage exists
    const stageKey = 'first_engagement';
    const stageCheck = await pool.query(
      "SELECT id FROM pipeline_stages WHERE org_id = $1 AND pipeline = 'leads' AND stage_key = $2",
      [orgId, stageKey]
    );
    if (stageCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO pipeline_stages (org_id, pipeline, stage_key, stage_label, sort_order, color, is_active)
         VALUES ($1, 'leads', $2, 'First Engagement', 1, '#10b981', true)`,
        [orgId, stageKey]
      );
      console.log('Created First Engagement stage');
    }

    const res = await pool.query(
      `UPDATE leads 
       SET org_id = COALESCE(org_id, organization_id), 
           organization_id = COALESCE(organization_id, org_id),
           title = COALESCE(title, split_part(email, '@', 1)), 
           name = COALESCE(name, split_part(email, '@', 1)),
           company_name = COALESCE(company_name, company),
           stage = $1,
           status = $1
       WHERE source = 'Instantly' AND (org_id IS NULL OR stage = 'new' OR stage = 'Interested' OR status = 'new')`,
      [stageKey]
    );
    console.log(`Fixed ${res.rowCount} leads`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
fixLeads();
