const admin = require('../config/firebase');
const { query } = require('../config/database');

/**
 * Send a push notification to a specific user
 * Works for both Web and Android tokens stored in fcm_tokens table
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    // 1. Get all tokens for this user from database using raw SQL
    const { rows: tokens } = await query(
      'SELECT token FROM fcm_tokens WHERE user_id = $1',
      [userId]
    );

    if (!tokens || tokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return;
    }

    const registrationTokens = tokens.map(t => t.token);

    // 2. Construct the message
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          badge: '1',
        }
      },
      tokens: registrationTokens,
    };

    // 3. Send via Firebase Admin
    if (!admin.apps || admin.apps.length === 0) {
      console.warn('[FCM] Firebase not initialized. Background notifications will not be sent.');
      return;
    }
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} messages to user ${userId}`);
    
    // Cleanup: If any tokens are invalid, remove them from DB
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        const errorCode = resp.error?.code;
        // Token is invalid or no longer registered
        if (!resp.success && (
          errorCode === 'messaging/invalid-registration-token' || 
          errorCode === 'messaging/registration-token-not-registered'
        )) {
          failedTokens.push(registrationTokens[idx]);
        }
      });
      
      if (failedTokens.length > 0) {
        await query(
          'DELETE FROM fcm_tokens WHERE token = ANY($1)',
          [failedTokens]
        );
        console.log(`Cleaned up ${failedTokens.length} invalid tokens`);
      }
    }

    return response;
  } catch (error) {
    console.error('Error sending FCM notification:', error);
  }
};

/**
 * Register or update an FCM token for a user
 */
const registerToken = async (userId, token, deviceType = 'web') => {
  try {
    // UPSERT logic matching schema: (user_id, token) UNIQUE
    await query(
      `INSERT INTO fcm_tokens (user_id, token, device_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET 
         device_type = EXCLUDED.device_type,
         updated_at = NOW()`,
      [userId, token, deviceType]
    );
    return true;
  } catch (error) {
    console.error('Error registering FCM token:', error);
    throw error;
  }
};

/**
 * Unregister/Remove an FCM token
 */
const unregisterToken = async (userId, token) => {
  try {
    await query(
      'DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2',
      [userId, token]
    );
    return true;
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    throw error;
  }
};

module.exports = {
  sendPushNotification,
  registerToken,
  unregisterToken,
};
