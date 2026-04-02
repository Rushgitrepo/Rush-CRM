const db = require('../config/database');

async function test() {
  try {
    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('--- TABLES (' + res.rows.length + ') ---');
    res.rows.forEach(r => console.log('  - ' + r.table_name));
    
    const userCols = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log('\n--- USERS COLUMNS (' + userCols.rows.length + ') ---');
    userCols.rows.forEach(r => console.log('  - ' + r.column_name));

    const contactCols = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'contacts'
      ORDER BY ordinal_position;
    `);
    console.log('\n--- CONTACTS COLUMNS ('+ contactCols.rows.length +') ---');
    contactCols.rows.forEach(r => console.log('  - ' + r.column_name));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
test();
