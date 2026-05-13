const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkDups() {
  try {
    const res = await pool.query(`
      SELECT email, count(id) FROM leads 
      WHERE source = 'Instantly' 
      GROUP BY email HAVING count(id) > 1
    `);
    
    if (res.rows.length === 0) {
      console.log('No duplicate leads found!');
    } else {
      console.table(res.rows);
      console.log(`Found ${res.rows.length} duplicate emails. Cleaning them up...`);
      
      for (const row of res.rows) {
        // Keep the oldest one
        const dups = await pool.query(
          "SELECT id FROM leads WHERE email = $1 AND source = 'Instantly' ORDER BY created_at ASC",
          [row.email]
        );
        
        const idsToDelete = dups.rows.slice(1).map(r => r.id);
        
        // Delete activities and workspace access for the duplicates to satisfy foreign keys
        await pool.query('DELETE FROM activities WHERE lead_id = ANY($1)', [idsToDelete]);
        await pool.query("DELETE FROM crm_activities WHERE entity_type = 'lead' AND entity_id = ANY($1)", [idsToDelete]);
        await pool.query('DELETE FROM lead_workspace_access WHERE lead_id = ANY($1)', [idsToDelete]);
        
        await pool.query('DELETE FROM leads WHERE id = ANY($1)', [idsToDelete]);
      }
      console.log('Duplicates deleted.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkDups();
