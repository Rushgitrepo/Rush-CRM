const db = require('./src/config/database');

async function checkTable() {
  try {
    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'crm_custom_field_templates'
    `);
    if (res.rows.length > 0) {
      console.log('Table exists');
    } else {
      console.log('Table does not exist');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTable();
