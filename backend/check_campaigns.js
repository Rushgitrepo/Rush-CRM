const db = require('./src/config/database');

async function check() {
  try {
    const res = await db.query(`SELECT id, metadata FROM unibox_emails WHERE metadata->>'campaign_name' IS NOT NULL LIMIT 5`);
    console.log("Emails with campaign_name:", res.rows.map(r => ({id: r.id, campaign_name: r.metadata.campaign_name, item_campaign_name: r.metadata.item?.campaign_name})));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
