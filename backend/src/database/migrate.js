const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  let currentSql = '';
  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');

    console.log('Running database migration (chunked for stability)...');
    
    const statements = [];
    let currentStatement = '';
    let inDollarBlock = false;

    const lines = migrationSQL.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      currentStatement += line + '\n';
      
      const occurrences = (line.match(/\$\$/g) || []).length;
      if (occurrences % 2 !== 0) {
        inDollarBlock = !inDollarBlock;
      }

      if (!inDollarBlock && line.trim().endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    let count = 0;
    for (const sql of statements) {
      if (sql) {
        currentSql = sql;
        await client.query(sql);
        count++;
      }
    }

    console.log(`Migration completed successfully! (${count} statements executed)`);
  } catch (err) {
    console.error('Migration failed on statement:');
    console.error(currentSql.substring(0, 500) + (currentSql.length > 500 ? '...' : ''));
    console.error('\nError:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
