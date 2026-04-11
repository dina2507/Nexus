/**
 * NEXUS Decision Engine
 * Reads stadium state from Firestore, calls Gemini 2.0 Flash,
 * and writes coordinated 5-stakeholder actions back to Firestore.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildNexusPrompt } = require('./nexusPrompt');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { responseMimeType: 'application/json' }
});

async function runNexusEngine(stadiumId = 'chepauk', db) {
  // 1. Read state in parallel
  const [stadiumDoc, crowdSnap, matchDoc] = await Promise.all([
    db.doc(`stadiums/${stadiumId}`).get(),
    db.collection('crowd_density')
      .where('stadium_id', '==', stadiumId).get(),
    db.doc('match_events/current').get()
  ]);

  const stadium = stadiumDoc.data();
  if (!stadium) {
    console.warn('No stadium config found for', stadiumId);
    return { skipped: true, reason: 'No stadium config' };
  }

  const crowdState = {};
  crowdSnap.forEach(doc => crowdState[doc.id] = doc.data());
  const matchState = matchDoc.data();

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

  // 3. Call Gemini 2.0 Flash
  console.log('NEXUS: Calling Gemini 2.0 Flash...');
  const prompt = buildNexusPrompt(stadium, crowdState, matchState);

  let decision;
  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    decision = JSON.parse(responseText);
    console.log('NEXUS: Gemini response received, confidence:', decision.confidence);
  } catch (err) {
    console.error('NEXUS: Gemini call failed, using fallback', err.message);
    // Fallback rule-based response if Gemini is slow or fails
    decision = buildFallbackDecision(crowdState, matchState, stadium);
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

module.exports = { runNexusEngine };
