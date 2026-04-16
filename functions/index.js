/**
 * NEXUS Cloud Functions Entry Point
 * Exports: crowdSimulatorCron, nexusOnCrowdUpdate, nexusTrigger
 */
require('dotenv').config();

const { setGlobalOptions } = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { simulateCrowd } = require('./crowdSimulator');
const { runNexusEngine } = require('./nexusEngine');
const { sendFanNudge } = require('./fanNudge');
const { requireOperator } = require('./middleware/auth');
const { simulateWeather } = require('./weatherSimulator');
const { simulateTicketScans } = require('./ticketScanSimulator');

admin.initializeApp();
const db = admin.firestore();

// Cost control: limit concurrent containers
setGlobalOptions({ maxInstances: 10 });

/**
 * Crowd simulator — runs every 1 minute on the minute.
 * Paired with crowdSimulatorCronOffset (below) to give ~30s cadence
 * without holding a single function instance alive for 30s.
 */
exports.crowdSimulatorCron = onSchedule('every 1 minutes', async () => {
  if (await isEnginePaused()) {
    console.log('NEXUS: Simulator skipped — engine paused');
    return;
  }
  console.log('NEXUS: Running crowd simulator tick (top of minute)...');
  const stadiumIds = await getAllStadiumIds();
  await Promise.all(stadiumIds.map(id => simulateCrowd(id, db)));
});

/**
 * Offset simulator — runs every 1 minute but at :30 thanks to its own
 * Cloud Scheduler cron expression. Cheaper than setTimeout(30000).
 */
exports.crowdSimulatorCronOffset = onSchedule(
  { schedule: '* * * * *', timeZone: 'Asia/Kolkata' },
  async () => {
    // 30s delay — runs at the half-minute mark of every minute.
    // We still need a small offset since Cloud Scheduler granularity is 1m.
    await new Promise(r => setTimeout(r, 30000));
    if (await isEnginePaused()) {
      console.log('NEXUS: Offset simulator skipped — engine paused');
      return;
    }
    console.log('NEXUS: Running crowd simulator tick (offset +30s)...');
    const stadiumIds = await getAllStadiumIds();
    await Promise.all(stadiumIds.map(id => simulateCrowd(id, db)));
  }
);

exports.weatherSimulatorCron = onSchedule('every 5 minutes', async () => {
  if (await isEnginePaused()) return;
  console.log('NEXUS: Running weather simulator...');
  const stadiumIds = await getAllStadiumIds();
  await Promise.all(stadiumIds.map(id => simulateWeather(id, db)));
});

exports.ticketScanSimulatorCron = onSchedule('every 1 minutes', async () => {
  if (await isEnginePaused()) return;
  console.log('NEXUS: Running ticket scan simulator...');
  const stadiumIds = await getAllStadiumIds();
  await Promise.all(stadiumIds.map(id => simulateTicketScans(id, db)));
});

async function isEnginePaused() {
  const snap = await db.doc('nexus_state/engine').get();
  return Boolean(snap.data()?.paused);
}

async function getAllStadiumIds() {
  const snap = await db.collection('stadiums').get();
  return snap.docs.map(doc => doc.id);
}

/**
 * NEXUS engine — triggers when any crowd_density document updates.
 * Only calls Gemini if the zone crosses the 80% threshold.
 */
exports.nexusOnCrowdUpdate = onDocumentUpdated(
  'crowd_density/{zoneId}',
  async (event) => {
    const after = event.data.after.data();
    if (after.pct >= 0.80) {
      console.log(`NEXUS: Zone ${event.params.zoneId} at ${(after.pct * 100).toFixed(1)}% — triggering engine`);
      await runNexusEngine(after.stadium_id, db);
    }
  }
);

/**
 * Manual trigger for demo controls.
 * POST { stadiumId, scenario } to run specific demo scenarios.
 */
exports.nexusTrigger = onRequest({ cors: true }, (req, res) => {
  requireOperator(req, res, async () => {
    const { stadiumId = 'chepauk', scenario, manualAction, emergencyBroadcast } = req.body;

  // Emergency broadcast — fan-wide FCM blast, bypasses Gemini and budget
  if (emergencyBroadcast) {
    console.log(`NEXUS: Emergency broadcast triggered for ${stadiumId}`);
    try {
      const fanSnap = await db.collection('fan_profiles')
        .where('stadium_id', '==', stadiumId).get();
      const tokens = [];
      fanSnap.forEach((d) => { if (d.data()?.fcm_token) tokens.push(d.data().fcm_token); });

      let messagingResult = { successCount: 0, failureCount: 0 };
      if (tokens.length > 0) {
        messagingResult = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: 'NEXUS · EMERGENCY ALERT',
            body: 'Stadium operators have issued an urgent advisory. Follow staff instructions immediately.',
          },
          data: { type: 'emergency_broadcast', stadium_id: stadiumId },
        });
      }

      // Log the broadcast as a P5 system action so it shows in the feed
      await db.collection('nexus_actions').add({
        stakeholder: 'system',
        action: 'EMERGENCY BROADCAST sent to all fans',
        priority: 5,
        status: 'dispatched',
        stadium_id: stadiumId,
        timestamp: new Date().toISOString(),
        risk_assessment: 'Operator-initiated emergency broadcast',
        confidence: 1.0,
        broadcast_recipients: tokens.length,
      });

      return res.json({
        success: true,
        type: 'emergency_broadcast',
        recipients: tokens.length,
        ...messagingResult,
      });
    } catch (err) {
      console.error('Emergency broadcast failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Operator manual override — skips AI engine entirely
  if (manualAction) {
    console.log(`NEXUS: Manual override — stakeholder: ${manualAction.stakeholder}`);
    try {
      await db.collection('nexus_actions').add({
        stakeholder: manualAction.stakeholder,
        action: manualAction.action,
        priority: manualAction.priority || 3,
        status: 'dispatched',
        stadium_id: stadiumId,
        timestamp: new Date().toISOString(),
        risk_assessment: 'Manual operator override',
        confidence: 1.0,
      });
      return res.json({ success: true, type: 'manual_override' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  console.log(`NEXUS: Manual trigger — scenario: ${scenario}`);

  try {
    if (scenario === 'halftime') {
      await db.doc('match_events/current').update({
        mins_to_halftime: 8,
        match_minute: 37
      });
      await db.doc('crowd_density/north_stand').update({ pct: 0.91 });
      await db.doc('crowd_density/concourse_a').update({ pct: 0.88 });

    } else if (scenario === 'gate_emergency') {
      await db.doc('crowd_density/north_stand').update({ pct: 0.95 });
      await db.doc('match_events/current').update({
        mins_to_halftime: 2,
        match_minute: 43
      });

    } else if (scenario === 'postmatch') {
      const postMatchBatch = db.batch();
      postMatchBatch.update(db.doc('crowd_density/north_stand'), { pct: 0.97 });
      postMatchBatch.update(db.doc('crowd_density/south_stand'), { pct: 0.95 });
      postMatchBatch.update(db.doc('crowd_density/east_block'),  { pct: 0.90 });
      postMatchBatch.update(db.doc('crowd_density/west_block'),  { pct: 0.88 });
      postMatchBatch.update(db.doc('crowd_density/concourse_a'), { pct: 0.93 });
      postMatchBatch.update(db.doc('match_events/current'), {
        match_minute: 112,
        mins_to_halftime: 0
      });
      await postMatchBatch.commit();

    } else if (scenario === 'reset') {
      const resetBatch = db.batch();
      resetBatch.update(db.doc('crowd_density/north_stand'), { pct: 0.35 });
      resetBatch.update(db.doc('crowd_density/south_stand'), { pct: 0.30 });
      resetBatch.update(db.doc('crowd_density/east_block'),  { pct: 0.25 });
      resetBatch.update(db.doc('crowd_density/west_block'),  { pct: 0.22 });
      resetBatch.update(db.doc('crowd_density/concourse_a'), { pct: 0.20 });
      resetBatch.update(db.doc('match_events/current'), {
        match_minute: -30,
        mins_to_halftime: 75,
        remaining_budget: 200000
      });
      await resetBatch.commit();
      return res.json({ success: true, scenario: 'reset', message: 'All zones reset to pre-match baseline' });
    }

    // Run the AI engine after setting the scenario — force bypasses throttle
    const result = await runNexusEngine(stadiumId, db, { force: true });

    const fanAction = result?.decision?.actions?.fans;
    if (fanAction?.incentive_inr > 0) {
      await sendFanNudge({
        ...fanAction,
        zone_label: fanAction.target_zone?.replaceAll('_', ' ')
      }, stadiumId);
    }

    res.json({ success: true, scenario, engine_result: result });

  } catch (err) {
    console.error('NEXUS: Trigger error', err);
    res.status(500).json({ error: err.message });
  }
  });
});

const { mintJwt, verifyJwt } = require('./voucher');

exports.mintVoucher = onRequest({ cors: true }, async (req, res) => {
  requireOperator(req, res, async () => {
    // We only mint for real user or demo user
    const { actionId, uid } = req.body;
    try {
      if (!actionId) return res.status(400).json({ error: 'Missing actionId' });
      
      const actionSnap = await db.doc(`nexus_actions/${actionId}`).get();
      if (!actionSnap.exists) return res.status(404).json({ error: 'Action not found' });
      
      const action = actionSnap.data();
      if (action.stakeholder !== 'fans' || action.status !== 'dispatched') {
        return res.status(400).json({ error: 'Action not valid for voucher' });
      }

      const payload = {
        jti: actionId + '_' + Date.now().toString(),
        uid: uid || req.uid || 'anon',
        action_id: actionId,
        zone: action.target_zone || '',
        inr: action.incentive_inr || 0,
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const secret = process.env.VOUCHER_SECRET || 'fallback_secret';
      const token = mintJwt(payload, secret);
      
      return res.json({ token, payload });
    } catch (err) {
      console.error('Mint voucher error', err);
      return res.status(500).json({ error: err.message });
    }
  });
});

exports.redeemVoucher = onRequest({ cors: true }, async (req, res) => {
  requireOperator(req, res, async () => {
    const { token } = req.body;
    try {
      if (!token) return res.status(400).json({ error: 'Missing token' });
      
      const secret = process.env.VOUCHER_SECRET || 'fallback_secret';
      const payload = verifyJwt(token, secret);

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return res.status(400).json({ error: 'Voucher expired' });
      }

      // Check replays
      const redeemRef = db.doc(`voucher_redemptions/${payload.jti}`);
      const redeemSnap = await redeemRef.get();
      if (redeemSnap.exists) {
        return res.status(400).json({ error: 'Voucher already redeemed' });
      }

      // Mark redeemed
      await redeemRef.set({
        redeemed_at: new Date().toISOString(),
        action_id: payload.action_id,
        uid: payload.uid,
        inr: payload.inr
      });

      return res.json({ success: true, message: 'Voucher redeemed successfully', inr: payload.inr });
    } catch (err) {
      console.error('Redeem voucher error', err);
      return res.status(401).json({ error: err.message });
    }
  });
});
