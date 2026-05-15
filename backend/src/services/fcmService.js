const admin = require('../config/firebase');
const { query } = require('../config/database');

/**
 * Send a push notification to a specific user
 * Works for both Web and Android tokens stored in fcm_tokens table
 */
// const sendPushNotification = async (userId, title, body, data = {}) => {
//   try {
//     // 1. Get all tokens for this user from database using raw SQL
//     const { rows: tokens } = await query(
//       `SELECT token FROM fcm_tokens WHERE user_id = $1`,
//       [userId]
//     );

//     if (!tokens || tokens.length === 0) {
//       console.log(`No FCM tokens found for user ${userId}`);
//       return;
//     }

//     const registrationTokens = tokens.map(t => t.token);

//     // 2. Construct the message
//     const message = {
//       notification: {
//         title: title,
//         body: body,
//       },
//       data: {
//         ...data,
//       },
//       android: {
//         priority: 'high',
//         notification: {
//           sound: 'default',
//           badge: '1',
//         }
//       },
//       tokens: registrationTokens,
//     };

//     // 3. Send via Firebase Admin
//     let messagingInstance;
//     try {
//       messagingInstance = admin.messaging();
//     } catch (initErr) {
//       console.warn('[FCM] Firebase not initialized. Background notifications will not be sent.');
//       return;
//     }

//     const response = await messagingInstance.sendEachForMulticast(message);
//     console.log(`[FCM] user=${userId} success=${response.successCount} failure=${response.failureCount}`);
//     response.responses.forEach((resp, idx) => {
//       if (resp.success) {
//         console.log(`[FCM] Token[${idx}] OK, messageId=${resp.messageId}`);
//       } else {
//         console.error(`[FCM] Token[${idx}] FAILED: code=${resp.error?.code} msg=${resp.error?.message}`);
//       }
//     });
//     // const response = await admin.messaging().sendEachForMulticast(message);

//     console.log(`Successfully sent ${response.successCount} messages to user ${userId}`);

//     // Cleanup: If any tokens are invalid, remove them from DB
//     if (response.failureCount > 0) {
//       const failedTokens = [];
//       response.responses.forEach((resp, idx) => {
//         const errorCode = resp.error?.code;
//         // Token is invalid or no longer registered
//         if (!resp.success && (
//           errorCode === 'messaging/invalid-registration-token' ||
//           errorCode === 'messaging/registration-token-not-registered'
//         )) {
//           failedTokens.push(registrationTokens[idx]);
//         }
//       });

//       if (failedTokens.length > 0) {
//         await query(
//           'DELETE FROM fcm_tokens WHERE token = ANY($1)',
//           [failedTokens]
//         );
//         console.log(`Cleaned up ${failedTokens.length} invalid tokens`);
//       }
//     }

//     return response;
//   } catch (error) {
//     console.error('Error sending FCM notification:', error);
//   }
// };

 
const sendPushNotification = async (
  userId,
  title,
  body,
  data = {}
) => {
  try {
    // 1. Get all FCM tokens for this user
    const { rows } = await query(
      `
      SELECT token, device_type
      FROM fcm_tokens
      WHERE user_id = $1
      `,
      [userId]
    );

    if (!rows || rows.length === 0) {
      console.log(`[FCM] No tokens found for user ${userId}`);
      return;
    }

    // 2. Optional:
    // Skip desktop if Electron notifications handled via socket
    const filteredTokens = rows
      .filter((t) => t.device_type !== "desktop")
      .map((t) => t.token);

    // 3. Remove duplicate tokens
    const registrationTokens = [...new Set(filteredTokens)];

    if (registrationTokens.length === 0) {
      console.log(`[FCM] No valid tokens after filtering`);
      return;
    }

    // 4. Convert all data values to string
    const formattedData = {};

    Object.entries(data).forEach(([key, value]) => {
      formattedData[key] =
        typeof value === "string"
          ? value
          : JSON.stringify(value);
    });

    // 5. Construct FCM message
    const message = {
      notification: {
        title,
        body,
      },

      data: formattedData,

      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
          clickAction: "OPEN_CHAT",
        },
      },

      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },

      webpush: {
        notification: {
          icon: "/logo.png",
          badge: "/badge.png",
          requireInteraction: true,
        },
      },

      tokens: registrationTokens,
    };

    // 6. Firebase messaging instance
    let messagingInstance;

    try {
      messagingInstance = admin.messaging();
    } catch (initErr) {
      console.warn(
        "[FCM] Firebase not initialized. Notifications not sent."
      );
      return;
    }

    // 7. Send notifications
    const response =
      await messagingInstance.sendEachForMulticast(message);

    console.log(
      `[FCM] user=${userId} success=${response.successCount} failure=${response.failureCount}`
    );

    // 8. Log responses
    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        console.log(
          `[FCM] Token[${idx}] SUCCESS messageId=${resp.messageId}`
        );
      } else {
        console.error(
          `[FCM] Token[${idx}] FAILED code=${resp.error?.code} message=${resp.error?.message}`
        );
      }
    });

    // 9. Cleanup invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];

      response.responses.forEach((resp, idx) => {
        const errorCode = resp.error?.code;

        if (
          !resp.success &&
          (
            errorCode ===
            "messaging/invalid-registration-token" ||
            errorCode ===
            "messaging/registration-token-not-registered"
          )
        ) {
          failedTokens.push(registrationTokens[idx]);
        }
      });

      if (failedTokens.length > 0) {
        await query(
          `
          DELETE FROM fcm_tokens
          WHERE token = ANY($1)
          `,
          [failedTokens]
        );

        console.log(
          `[FCM] Removed ${failedTokens.length} invalid tokens`
        );
      }
    }

    return response;
  } catch (error) {
    console.error(
      "[FCM] Error sending push notification:",
      error
    );
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
