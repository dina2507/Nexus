/**
 * NEXUS Gemini Prompt Template
 * Builds the full context prompt for Gemini 2.0 Flash decision engine.
 */
function buildNexusPrompt(stadium, crowdState, matchState, historicalPatterns, weatherState, gateState) {
  const zonesContext = stadium.zones.map(z => ({
    id: z.id,
    label: z.label,
    capacity: z.capacity,
    current_pct: crowdState[z.id]?.pct ?? 0,
    current_count: Math.round((crowdState[z.id]?.pct ?? 0) * z.capacity),
    crush_threshold_count: Math.round(stadium.crush_threshold * z.capacity),
    adjacent_zones: z.adjacent_zones,
    throughput_per_min: z.throughput_per_min,
    concessions: z.concessions,
    medical_post: z.medical_post
  }));

  // Historical pattern block — only inject if we have something useful.
  // Helps Gemini ground its predictions in prior matches at this venue.
  const historyBlock = historicalPatterns && Array.isArray(historicalPatterns.patterns)
    ? `

HISTORICAL PATTERNS (past matches at this venue):
${historicalPatterns.patterns.map((p, i) =>
  `${i + 1}. ${p.label} — ${p.description} (outcome: ${p.outcome})`
).join('\n')}
`
    : '';

  const weatherBlock = weatherState
    ? `
WEATHER:
- Temp: ${weatherState.temp_c}°C
- Condition: ${weatherState.condition} (precip: ${weatherState.precip_mm}mm, wind: ${weatherState.wind_kmh}km/h)
- Rule: If precip > 5mm, expect concourse rush.`
    : '';

  const gateBlock = gateState && Object.keys(gateState).length > 0
    ? `
GATE THROUGHPUT (scans per minute):
${Object.entries(gateState).map(([gateId, data]) => `- ${gateId}: ${data.scan_rate_per_min || 0} scans/min`).join('\n')}`
    : '';

  return `
You are NEXUS, the AI operations engine for ${stadium.name}.
Stadium capacity: ${stadium.total_capacity}. Current attendance: ${matchState.attendance}.

ZONE STATE (real-time, updated 30s ago):
${JSON.stringify(zonesContext, null, 2)}

MATCH CONTEXT:
- Over: ${matchState.over}, Score: ${matchState.score}
- Halftime in: ${matchState.mins_to_halftime} minutes
- Incentive budget remaining: ₹${matchState.remaining_budget}
${historyBlock}${weatherBlock}${gateBlock}
PHYSICAL CONSTRAINTS:
- Crush threshold: ${stadium.crush_threshold * 100}% (action required above this)
- Critical threshold: ${stadium.critical_threshold * 100}% (human approval required)
- Concession prep lead time: 6 minutes
- Medical repositioning lead time: 4 minutes
- Fan nudge rule: max 1 per zone per 10 minutes

TASK:
Analyze risks forming in the next 10 minutes and generate a coordinated response.
Respond ONLY with valid JSON matching this exact schema:

{
  "risk_assessment": "2 sentences max describing what risk is forming and why",
  "confidence": 0.0,
  "actions": {
    "security": {
      "action": "specific gate/staff instruction",
      "target": "gate_id or zone_id",
      "priority": 1,
      "reason": "one sentence"
    },
    "fans": {
      "action": "notification message text (max 120 chars)",
      "target_zone": "zone_id",
      "incentive_inr": 0,
      "priority": 1,
      "reason": "one sentence"
    },
    "concessions": {
      "action": "specific prep instruction",
      "target_stand": "stand_id",
      "quantity_change": 0,
      "lead_time_mins": 6,
      "priority": 1,
      "reason": "one sentence"
    },
    "medical": {
      "action": "reposition or standby instruction",
      "target_position": "location description",
      "priority": 1,
      "reason": "one sentence"
    },
    "transport": {
      "action": "hold or dispatch instruction",
      "vehicles": 0,
      "hold_mins": 0,
      "priority": 1,
      "reason": "one sentence"
    }
  }
}

Rules:
- If no action needed for a stakeholder, set action to "" and priority to 0
- Priority 1-2: informational. Priority 3: standard action. Priority 4-5: urgent (human review)
- Never recommend opening a gate if adjacent gate is already above 85% throughput
- Fan nudge must be actionable and include the benefit clearly
`;
}

module.exports = { buildNexusPrompt };
