const webpush = require('web-push');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const VAPID_KEYS_FILE = path.join(__dirname, '../../vapid_keys.json');

let vapidConfigured = false;

function getVapidKeys() {
  let keys;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  } else if (fs.existsSync(VAPID_KEYS_FILE)) {
    keys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf8'));
  } else {
    keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(keys, null, 2));
    console.log('\n=== VAPID keys generated. Add to .env to persist across restarts: ===');
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log('=====================================================================\n');
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(
      'mailto:admin@rushcorporation.com',
      keys.publicKey,
      keys.privateKey
    );
    vapidConfigured = true;
  }

  return keys;
}

async function saveSubscription(userId, orgId, subscription) {
  await db.query(
    `INSERT INTO push_subscriptions (user_id, org_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, orgId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  );
}

async function removeSubscription(userId, endpoint) {
  await db.query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint]
  );
}

async function sendPushToUser(userId, payload) {
  try {
    getVapidKeys();
    const result = await db.query(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
      [userId]
    );

    const failedEndpoints = [];
    for (const sub of result.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 }
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    }

    for (const endpoint of failedEndpoints) {
      await db.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
    }
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

// Initialize table and VAPID on module load
getVapidKeys();

module.exports = { getVapidKeys, saveSubscription, removeSubscription, sendPushToUser };
