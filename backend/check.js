const db = require('./src/config/database');
db.query("SELECT DISTINCT metadata->>'campaign_name' as campaign_name FROM unibox_emails WHERE metadata->>'campaign_name' IS NOT NULL LIMIT 10")
  .then(res => {
    console.log(res.rows);
    process.exit(0);
  });
