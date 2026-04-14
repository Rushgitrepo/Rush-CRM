
const db = require('./backend/src/config/database');
async function checkColumns() {
  try {
    const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log(res.rows.map(r => r.column_name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkColumns();
