const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

async function check() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lines = [];
  
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );
  
  lines.push('total_tables=' + tables.rows.length);
  
  for (const t of tables.rows) {
    const res = await pool.query('SELECT COUNT(*) as cnt FROM "' + t.table_name + '"');
    const cnt = parseInt(res.rows[0].cnt);
    if (cnt > 0) {
      lines.push('data|' + t.table_name + '|' + cnt);
    }
  }
  
  const orgs = await pool.query('SELECT id, name FROM organizations');
  lines.push('orgs=' + orgs.rows.length);
  orgs.rows.forEach(function(r) { lines.push('org|' + r.id + '|' + r.name); });
  
  const users = await pool.query('SELECT email, org_id FROM users');
  lines.push('users=' + users.rows.length);
  users.rows.forEach(function(r) { lines.push('user|' + r.email + '|' + r.org_id); });
  
  await pool.end();
  
  var buf = Buffer.from(lines.join('\n'), 'ascii');
  fs.writeFileSync('db_report.txt', buf);
  process.stdout.write('done\n');
}

check().catch(function(e) { process.stderr.write(e.message + '\n'); process.exit(1); });
