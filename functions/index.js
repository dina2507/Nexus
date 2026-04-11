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

admin.initializeApp();
const db = admin.firestore();

// Cost control: limit concurrent containers
setGlobalOptions({ maxInstances: 10 });

/**
 * Crowd simulator — runs every 1 minute.
 * Executes twice per invocation (~30s apart) to approximate 30s updates.
 */
exports.crowdSimulatorCron = onSchedule('every 1 minutes', async () => {
  console.log('NEXUS: Running crowd simulator tick 1...');
  await simulateCrowd('chepauk', db);

  // Wait 30s, then run again for 2x per minute
  await new Promise(r => setTimeout(r, 30000));

  console.log('NEXUS: Running crowd simulator tick 2...');
  await simulateCrowd('chepauk', db);
});

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
exports.nexusTrigger = onRequest({ cors: true }, async (req, res) => {
  const { stadiumId = 'chepauk', scenario } = req.body;
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

    // Run the AI engine after setting the scenario
    const result = await runNexusEngine(stadiumId, db);

    const fanAction = result?.decision?.actions?.fans;
    if (fanAction?.incentive_inr > 0) {
      await sendFanNudge({
        ...fanAction,
        zone_label: fanAction.target_zone?.replace('_', ' ')
      }, stadiumId);
    }

    res.json({ success: true, scenario, engine_result: result });

  } catch (err) {
    console.error('NEXUS: Trigger error', err);
    res.status(500).json({ error: err.message });
  }
});
