/**
 * NEXUS Decision Engine
 * Reads stadium state from Firestore, calls Gemini 2.0 Flash,
 * and writes coordinated 5-stakeholder actions back to Firestore.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { buildNexusPrompt } = require('./nexusPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { responseMimeType: 'application/json' }
});

// Minimum gap between Gemini calls — prevents 5 parallel calls from a
// single 5-zone batch write by the crowd simulator.
const THROTTLE_MS = 25_000;

async function runNexusEngine(stadiumId = 'chepauk', db, { force = false } = {}) {
  // 0a. Pause guard — operator kill switch from the dashboard
  const stateRef = db.doc('nexus_state/engine');
  const stateSnap = await stateRef.get();
  if (stateSnap.data()?.paused) {
    console.log('NEXUS: Engine paused by operator — skipping');
    return { skipped: true, reason: 'Paused' };
  }

  // 0b. Throttle — skip if called within the last THROTTLE_MS milliseconds
  if (!force) {
    const canRun = await db.runTransaction(async (t) => {
      const stateDoc = await t.get(stateRef);
      const lastCall = stateDoc.data()?.last_call;
      if (lastCall && (Date.now() - new Date(lastCall).getTime()) < THROTTLE_MS) {
        return false;
      }
      t.set(stateRef, { last_call: new Date().toISOString() }, { merge: true });
      return true;
    });

    if (!canRun) {
      console.log('NEXUS: Throttled — called too recently, skipping');
      return { skipped: true, reason: 'Throttled' };
    }
  }

  // 1. Read state in parallel (now includes historical patterns)
  const [stadiumDoc, crowdSnap, matchDoc, historyDoc, weatherDoc, gatesSnap] = await Promise.all([
    db.doc(`stadiums/${stadiumId}`).get(),
    db.collection('crowd_density').where('stadium_id', '==', stadiumId).get(),
    db.doc('match_events/current').get(),
    db.doc(`historical_patterns/${stadiumId}`).get(),
    db.doc(`weather/${stadiumId}`).get(),
    db.collection('gates').where('stadium_id', '==', stadiumId).get(),
  ]);

  const stadium = stadiumDoc.data();
  if (!stadium) {
    console.warn('No stadium config found for', stadiumId);
    return { skipped: true, reason: 'No stadium config' };
  }

  const crowdState = {};
  crowdSnap.forEach(doc => crowdState[doc.id] = doc.data());
  const matchState = matchDoc.data();
  const historicalPatterns = historyDoc.exists ? historyDoc.data() : null;
  const weatherState = weatherDoc.exists ? weatherDoc.data() : null;
  const gateState = {};
  gatesSnap.forEach(doc => gateState[doc.id] = doc.data());

  if (!matchState) {
    console.warn('No match_events/current document found');
    return { skipped: true, reason: 'No match state' };
  }

  // 2. Only fire if there's a risk worth acting on
  const hasRisk = Object.values(crowdState)
    .some(z => z.pct >= stadium.crush_threshold)
    || matchState.mins_to_halftime <= 10;

  if (!hasRisk) {
    console.log('NEXUS: No zones at threshold, skipping Gemini call');
    return { skipped: true, reason: 'No zones at threshold' };
  }

  // 2.5 Budget depletion guard
  const budgetExhausted = (matchState.remaining_budget || 0) <= 0;
  if (budgetExhausted) {
    const stateRef = db.doc('nexus_state/engine');
    const stateDoc = await stateRef.get();
    const lastWarning = stateDoc.data()?.last_budget_warning;
    
    // Deduplicate: Only write this system action once every 30 minutes
    if (!lastWarning || (Date.now() - new Date(lastWarning).getTime()) > 30 * 60 * 1000) {
      console.warn('NEXUS: Fan incentive budget exhausted — emitting system warning');
      await db.collection('nexus_actions').add({
        stakeholder: 'system',
        action: 'Fan incentive budget exhausted — all remaining nudges will be non-incentivized.',
        priority: 2,
        status: 'dispatched',
        stadium_id: stadiumId,
        timestamp: new Date().toISOString(),
        risk_assessment: 'Budget depleted',
        confidence: 1.0,
      });
      await stateRef.set({ last_budget_warning: new Date().toISOString() }, { merge: true });
    }
  }

  // 3. Call Gemini 2.0 Flash
  console.log('NEXUS: Calling Gemini 2.0 Flash...');
  const prompt = buildNexusPrompt(stadium, crowdState, matchState, historicalPatterns, weatherState, gateState);

  let decision;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      if (attempt === 1) await new Promise(r => setTimeout(r, 500));
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      decision = JSON.parse(responseText);
      console.log('NEXUS: Gemini response received, confidence:', decision.confidence);
      break;
    } catch (err) {
      if (attempt === 0) {
        console.warn('NEXUS: Gemini attempt 1 failed, retrying in 500ms...', err.message);
      } else {
        console.error('NEXUS: Gemini call failed after retry, using fallback', err.message);
        decision = buildFallbackDecision(crowdState, matchState, stadium);
      }
    }
  }

  // 4. Write all actions atomically
  const batch = db.batch();
  const timestamp = new Date().toISOString();

  Object.entries(decision.actions).forEach(([stakeholder, action]) => {
    if (!action.action) return; // Skip if no action needed
    const ref = db.collection('nexus_actions').doc();
    batch.set(ref, {
      stakeholder,
      ...action,
      risk_assessment: decision.risk_assessment,
      confidence: decision.confidence,
      stadium_id: stadiumId,
      timestamp,
      // Auto-dispatch routine actions, queue critical for human review
      status: action.priority >= 4 ? 'pending' : 'dispatched'
    });
  });

  await batch.commit();
  console.log('NEXUS: Actions written to Firestore');

  // Override fan incentive if budget is exhausted
  if (budgetExhausted && decision.actions?.fans) {
    decision.actions.fans.incentive_inr = 0;
    decision.actions.fans.action = '';
  }

  // Deduct incentive budget — estimate 500 fans nudged per dispatch
  const fanAction = decision.actions?.fans;
  if (fanAction?.incentive_inr > 0 && fanAction.action) {
    await db.doc('match_events/current').update({
      remaining_budget: admin.firestore.FieldValue.increment(-(fanAction.incentive_inr * 500))
    });
    console.log(`NEXUS: Budget decremented by ₹${fanAction.incentive_inr * 500}`);
  }

  return { success: true, actions: Object.keys(decision.actions).length, decision };
}

/**
 * Fallback rule-based engine when Gemini is unavailable or slow (>2s).
 * Provides basic coordinated response based on density thresholds.
 */
function buildFallbackDecision(crowdState, matchState, stadium) {
  const hotZone = Object.entries(crowdState)
    .sort((a, b) => b[1].pct - a[1].pct)[0];
  const hotZoneId = hotZone ? hotZone[0] : 'north_stand';
  const hotPct = hotZone ? hotZone[1].pct : 0;

  const isCritical = hotPct >= stadium.critical_threshold;
  const priority = isCritical ? 4 : 3;

  return {
    risk_assessment: `Fallback engine: ${hotZoneId} at ${(hotPct * 100).toFixed(0)}% density. ${isCritical ? 'Critical threshold exceeded — human review required.' : 'Approaching crush threshold — taking preventive action.'}`,
    confidence: 0.65,
    actions: {
      security: {
        action: `Open alternate gates near ${hotZoneId}. Redirect foot traffic.`,
        target: hotZoneId,
        priority: priority,
        reason: 'Relieve pressure on congested zone'
      },
      fans: {
        action: `Avoid ${hotZoneId.replace('_', ' ')} — use alternate route for faster exit. ₹80 voucher available!`,
        target_zone: hotZoneId,
        incentive_inr: 80,
        priority: priority,
        reason: 'Incentivize crowd redistribution'
      },
      concessions: {
        action: 'Prep 200 extra units at alternate stands',
        target_stand: hotZoneId,
        quantity_change: 200,
        lead_time_mins: 6,
        priority: 2,
        reason: 'Anticipate redirected fans needing service'
      },
      medical: {
        action: `Reposition standby unit near ${hotZoneId} exits`,
        target_position: `${hotZoneId} NW corridor`,
        priority: 2,
        reason: 'Precautionary repositioning near high-density zone'
      },
      transport: {
        action: 'Hold 3 buses for 20 minutes post-match',
        vehicles: 3,
        hold_mins: 20,
        priority: 2,
        reason: 'Ensure transport availability during exit surge'
      }
    }
  };
}

module.exports = { runNexusEngine, buildFallbackDecision };
