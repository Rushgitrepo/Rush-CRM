const db = require('./src/config/database');

async function check() {
  const res = await db.query('SELECT filename FROM migrations WHERE filename = $1', ['20240407_crm_activity_optimizations.sql']);
  if (res.rows.length > 0) {
    console.log('Migration already executed');
  } else {
    console.log('Migration NOT executed');
  }
  process.exit(0);
}

check();
