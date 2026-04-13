const admin = require('firebase-admin');

/**
 * Sends a fan nudge to all registered devices for the stadium.
 */
async function sendFanNudge(fanAction, stadiumId = 'chepauk') {
  if (!fanAction || !fanAction.action || !fanAction.incentive_inr) {
    return { skipped: true, reason: 'No fan incentive action' };
  }

  const db = admin.firestore();
  const snap = await db.collection('fan_profiles')
    .where('stadium_id', '==', stadiumId)
    .get();

  const tokens = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data?.fcm_token) tokens.push(data.fcm_token);
  });

  if (tokens.length === 0) {
    return { skipped: true, reason: 'No fan tokens registered' };
  }

  const message = {
    tokens,
    notification: {
      title: `NEXUS Alert — ${fanAction.zone_label || fanAction.target_zone?.replaceAll('_', ' ') || 'Chepauk'}`,
      body: fanAction.action,
    },
    data: {
      incentive_inr: String(fanAction.incentive_inr),
      target_zone: fanAction.target_zone || '',
      stadium_id: stadiumId,
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log('Successfully sent fan nudges:', response.successCount);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

module.exports = { sendFanNudge };
