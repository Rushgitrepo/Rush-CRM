const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function compareTables() {
  const sqlFile = path.join(__dirname, 'schema.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  const tableMatches = sqlContent.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:(?:public\.)|(?:"public"\.))?([a-zA-Z0-9_]+)/gi);
  const sqlTables = new Set();
  for (const match of tableMatches) {
    sqlTables.add(match[1].toLowerCase());
  }

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
    
    const dbTables = new Set(result.rows.map(r => r.table_name.toLowerCase()));

    console.log('--- COMPARING TABLES ---');
    console.log(`Tables in schema.sql: ${sqlTables.size}`);
    console.log(`Tables in database: ${dbTables.size}`);

    const onlyInSql = [...sqlTables].filter(t => !dbTables.has(t)).sort();
    const onlyInDb = [...dbTables].filter(t => !sqlTables.has(t)).sort();

    console.log('\nNodes only in schema.sql (Missing from DB):');
    if (onlyInSql.length === 0) console.log('  (None)'); else onlyInSql.forEach(t => console.log(`  - ${t}`));

    console.log('\nNodes only in database (Extra in DB):');
    if (onlyInDb.length === 0) console.log('  (None)'); else onlyInDb.forEach(t => console.log(`  - ${t}`));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

compareTables();
