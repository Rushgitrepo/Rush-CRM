const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('\n--- IMPORTING DATABASE ---\n');

async function importDatabase() {
  let sqlFile = path.join(__dirname, 'CRM.sql');

  if (!fs.existsSync(sqlFile)) {
    sqlFile = path.join(__dirname, '..', '..', 'CRM.sql');
  }

  if (!fs.existsSync(sqlFile)) {
    console.error('ERROR: CRM.sql not found!');
    console.log('Searched in:');
    console.log('  - backend/src/database/CRM.sql');
    console.log('  - backend/CRM.sql');
    process.exit(1);
  }

  console.log('Found SQL file:', sqlFile);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Reading SQL file...');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('Enabling extensions...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    console.log('Processing SQL statements...\n');

    // SQL parser - handles quotes, semicolons, dollar-quoted strings
    const statements = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < sqlContent.length; i++) {
      const ch = sqlContent[i];

      if (ch === "'" && !inQuote) {
        inQuote = true;
      } else if (ch === "'" && inQuote) {
        if (i + 1 < sqlContent.length && sqlContent[i + 1] === "'") {
          current += "''";
          i++;
          continue;
        }
        inQuote = false;
      }

      current += ch;

      if (ch === ';' && !inQuote) {
        const stmt = current.trim();
        if (stmt.length > 1 && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        current = '';
      }
    }

    if (current.trim().length > 1) {
      statements.push(current.trim());
    }

    console.log(`Found ${statements.length} SQL statements\n`);

    let success = 0, errors = 0, tables = 0, inserts = 0;
    const errorList = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await pool.query(stmt);
        success++;

        if (stmt.toUpperCase().includes('CREATE TABLE')) {
          tables++;
          const m = stmt.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
          if (m) console.log(`  [OK] Created table: ${m[1]}`);
        } else if (stmt.toUpperCase().includes('INSERT INTO')) {
          inserts++;
        }

        if ((i + 1) % 100 === 0) {
          console.log(`  Progress: ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        errors++;
        if (errorList.length < 15) {
          errorList.push({
            idx: i + 1,
            preview: stmt.substring(0, 90).replace(/\n/g, ' '),
            msg: err.message.substring(0, 150)
          });
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('DATABASE IMPORT COMPLETED');
    console.log('='.repeat(60));
    console.log(`  Total Statements: ${statements.length}`);
    console.log(`  Successful: ${success}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Tables Created: ${tables}`);
    console.log(`  Data Inserts: ${inserts}`);

    if (errorList.length > 0) {
      console.log(`\nFirst ${errorList.length} errors:`);
      errorList.forEach((e, idx) => {
        console.log(`\n  ${idx + 1}. [#${e.idx}] ${e.preview}...`);
        console.log(`     Error: ${e.msg}`);
      });
    }

    // Verify
    console.log('\nVerifying...');
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`Total tables in database: ${result.rows.length}`);
    result.rows.forEach(r => console.log(`  - ${r.table_name}`));
    console.log('\nYou can now start the server: npm run dev\n');

  } catch (error) {
    console.error('\nImport failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importDatabase();