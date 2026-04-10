# NEXUS — Stadium Nervous System
## Project Knowledge Base for Gemini Gem

---

## What is NEXUS?

NEXUS (Neural Event eXperience Unified System) is an AI-powered stadium operations coordination platform built for the **Google PromptWars Week 1 Challenge** — "Physical Event Experience."

It is NOT a fan-facing app. It is the **AI coordination layer** between all stakeholders at a large-scale sporting venue: security, fans, concessions, medical, and transport — all coordinated simultaneously by a single Gemini API decision engine.

**Tagline:** "Air traffic control for a stadium."

**Demo venue:** MA Chidambaram Stadium (Chepauk), Chennai — CSK vs MI, IPL 2026.

---

## The Core Problem NEXUS Solves

Most teams will build fan apps with queue timers. NEXUS solves the real problem: **stadium staff, security, food vendors, medical, and transport all operate in complete isolation with no shared intelligence.** The result is reactive decisions made too late.

Key insight: Halftime at a cricket stadium is a perfectly predictable event. It happens at a known time. Yet every stadium treats it as a surprise. NEXUS knows it's coming 8 minutes before the whistle — and acts before the surge forms.

**The 5 congestion zones (by phase):**
1. Pre-entry: road approach chokepoints, parking, cab drop zones
2. Gate entry: security scan throughput = 45s/person × 4 lanes = 320 ppl/min max
3. Inside concourse: designed for 30% movement, but 70-80% are on concourse pre-kickoff
4. Halftime: 30,000 people stand up simultaneously — 15-minute window
5. Post-match exit: most dangerous — historical crush incidents happen here

---

## Full Google Tech Stack

| Product | Role in NEXUS |
|---|---|
| **Gemini 2.0 Flash** | AI decision engine — receives stadium state, returns 5-stakeholder action JSON |
| **Gemini Embeddings** | Semantic search on historical incident patterns (RAG layer) |
| **Firestore** | Real-time crowd_density, nexus_actions, stadium configs, fan profiles |
| **Cloud Functions** | nexusDecisionEngine(), crowdSimulator(), fanNudge() |
| **Cloud Scheduler** | Triggers simulator + engine every 30 seconds |
| **Firebase Auth** | Google SSO for operators, anonymous auth for fans |
| **Firebase Hosting** | Hosts React ops dashboard + fan PWA |
| **Firebase Cloud Messaging** | Push notifications to fans ("₹80 voucher — go to Stand C") |
| **Firebase Storage** | Stadium config JSONs, post-match reports |
| **Google Maps JS API** | Stadium zone overlay heatmap, fan routing directions |
| **Cloud Pub/Sub** | Event bus: crowd_events → 5 stakeholder subscriber topics |
| **Firebase Analytics** | Tracks nudge acceptance rate, AI decision outcomes |

**9 Google products total.** This depth is a competitive differentiator.

---

## Project Folder Structure

```
nexus/
├── functions/
│   ├── index.js                ← exports all Cloud Functions
│   ├── nexusEngine.js          ← Gemini decision engine (CORE FILE)
│   ├── crowdSimulator.js       ← fake sensor data generator
│   ├── nexusPrompt.js          ← master Gemini prompt template (CORE FILE)
│   ├── fanNudge.js             ← FCM push notification sender
│   └── package.json
├── src/
│   ├── pages/
│   │   ├── OpsDashboard.jsx    ← main judge-facing screen (CORE FILE)
│   │   ├── FanApp.jsx          ← fan mobile PWA view (CORE FILE)
│   │   ├── DemoControls.jsx    ← hidden demo trigger panel
│   │   └── MatchReport.jsx     ← post-match summary
│   ├── components/
│   │   ├── ZoneDensityBars.jsx
│   │   ├── ActionFeed.jsx
│   │   ├── StadiumMap.jsx      ← Google Maps integration
│   │   ├── ApprovalQueue.jsx   ← human-in-loop panel
│   │   └── ImpactChart.jsx
│   ├── firebase/
│   │   ├── config.js
│   │   └── collections.js
│   ├── data/
│   │   └── chepauk.json        ← Chepauk stadium config
│   └── App.jsx
├── public/
│   └── firebase-messaging-sw.js
├── firebase.json
├── firestore.rules
└── .env
```

---

## Firestore Data Schema

### `/stadiums/{stadiumId}`
```json
{
  "id": "chepauk",
  "name": "MA Chidambaram Stadium, Chennai",
  "total_capacity": 38000,
  "coords": { "lat": 13.0631, "lng": 80.2790 },
  "crush_threshold": 0.82,
  "critical_threshold": 0.93,
  "zones": [...],
  "incentive_config": {
    "min_value_inr": 50,
    "standard_value_inr": 100,
    "max_budget_per_match_inr": 200000,
    "acceptance_rate_at_100": 0.68
  }
}
```

### `/crowd_density/{zoneId}`
```json
{
  "pct": 0.87,
  "stadium_id": "chepauk",
  "updated_at": "ISO timestamp"
}
```

### `/nexus_actions/{actionId}`
```json
{
  "stakeholder": "fans | security | concessions | medical | transport",
  "action": "text of what to do",
  "target": "zone or gate id",
  "priority": 1-5,
  "status": "pending | dispatched | approved | rejected",
  "risk_assessment": "Gemini's 2-sentence reasoning",
  "confidence": 0.0-1.0,
  "incentive_inr": 80,
  "stadium_id": "chepauk",
  "timestamp": "ISO timestamp"
}
```

### `/match_events/current`
```json
{
  "match_minute": -30,
  "mins_to_halftime": 45,
  "score": "122/4",
  "over": 15,
  "attendance": 38000,
  "weather": "Clear, 28°C",
  "remaining_budget": 185000
}
```

### `/fan_profiles/{fanId}`
```json
{
  "seat_section": "F",
  "gate": "G7",
  "zone": "north_stand",
  "fcm_token": "...",
  "last_nudge_at": "ISO timestamp",
  "nudges_accepted": 2,
  "wallet_balance_inr": 150
}
```

---

## The Gemini Prompt Architecture

The master prompt (`nexusPrompt.js`) injects:
1. Stadium config (layout, zone capacities, choke points, adjacency map)
2. Current crowd state (pct per zone)
3. Match state (over, halftime timing, weather)
4. Constraints (budget remaining, last nudge time per zone, lead times)

Returns structured JSON with `responseMimeType: "application/json"` — **never needs string parsing.**

Format returned:
```json
{
  "risk_assessment": "2 sentence summary",
  "confidence": 0.87,
  "actions": {
    "security": { "action": "...", "target": "G7", "priority": 3, "reason": "..." },
    "fans": { "action": "nudge text", "target_zone": "north_stand", "incentive_inr": 80, "priority": 3 },
    "concessions": { "action": "prep 240 units at Zone B", "lead_time_mins": 6, "priority": 2 },
    "medical": { "action": "reposition Unit 2 to NW corridor", "priority": 2 },
    "transport": { "action": "hold 3 buses 22 min", "vehicles": 3, "hold_mins": 22, "priority": 2 }
  }
}
```

---

## Human-in-the-Loop Model

| Mode | When | How |
|---|---|---|
| **Supervised** | First 2 matches at any venue | All actions queue for human approval before dispatch |
| **Autonomous** | Normal operations | Auto-dispatch for priority ≤ 3; human sees live feed with 90s revert window |
| **Emergency gate** | Priority 4-5 / above 93% density | 60-second countdown on dashboard — confirm or auto-escalate |

Operators can always: pause all nudges, force open/close any gate, switch to full manual, trigger emergency broadcast, revoke dispatched actions within 90s.

---

## Incentive Logic

```
fans_to_move = current_zone_count - crush_threshold_count
redirect_rate_needed = fans_to_move / zone_population
incentive_value = min_effective + (redirect_rate_needed × sensitivity_factor)
```

**Tiers:**
- Below 70%: no action
- 70–80%: informational nudge (no incentive)
- 80–88%: incentivized redirect ₹80–150
- 88–93%: full coordination (all 5 stakeholders)
- Above 93%: human-in-loop mandatory

**Incentive types:** food voucher (default), parking priority (pre-match), fast-track entry (premium fans), merchandise discount, loyalty points (season holders)

**Key judge answer:** "What if fans ignore the incentive?" — NEXUS simultaneously opens alternative gates AND repositions staff. The incentive is a soft layer on top of hard operational decisions. Even 0% acceptance still relieves pressure.

---

## Stadium Configuration System

Every stadium is a JSON config file. NEXUS is layout-agnostic.

**Key config fields:**
- `zones[]`: capacity, gates, adjacent_zones, throughput_per_min, historical_surge_minute
- `concession_stands[]`: prep_lead_time_min, max_throughput
- `approach_roads[]`: serves_gates, max_vehicles_per_min
- `adjacency_map`: which zones overflow into each other
- `incentive_config`: budget ceiling, acceptance rate history

**Adding a new stadium — 3 steps:**
1. Admin fills stadium config form in NEXUS admin panel
2. NEXUS calibration — simulator runs 10 virtual matches
3. First 2 live matches in supervised mode, then autonomous

---

## The 5-Minute Demo Script

**Minute 0–1:** Open ops dashboard. Chepauk loaded. "It's 7:38 PM. CSK vs MI. 38,000 fans. Over 14."

**Minute 1–2:** Click "Simulate halftime in 8 min." Watch North Stand climb 74% → 81% → 87%. Crowd pressure index 5.2 → 7.4. Five actions fire simultaneously in 3 seconds.

**Minute 2–3:** Switch to phone/mobile tab. Show FCM notification arriving. Show ₹80 voucher + step-by-step route to Stand C.

**Minute 3–4:** Click one AI decision. Show Gemini's reasoning: "North Stand exit capacity is 320/min. At halftime 3,800 fans will attempt exit — recommending redirect + gate opening."

**Minute 4–5:** Fast-forward simulator. North Stand peaked at 84% instead of historical 97%. Queue wait: 9 min → 4 min. Summary: "143 AI decisions, 0 incidents, ₹12,400 incentives issued, ₹3.8L security overtime saved."

**The killer visual:** Before/after arrival curve chart. Unmanaged spike to 97% vs NEXUS-managed flat curve below 85%.

---

## Key Judge Questions + Answers

| Question | Answer |
|---|---|
| "What if Gemini is slow?" | Fallback rule-based engine kicks in if response >2s. Gemini Flash avg 1.1s. |
| "What if fans ignore nudges?" | Gates + staff still act. Incentive is soft layer on hard operational actions. |
| "How do you handle different stadiums?" | JSON config file. Any stadium onboards in one afternoon. Show the 3-step flow. |
| "What about privacy?" | No PII stored. Zone-level only. Fan app uses anonymous Firebase Auth. |
| "Is this real-time or batch?" | Firestore onSnapshot = sub-100ms UI update. Decision engine runs every 30s on cron. |
| "How is this better than existing systems?" | Existing systems are siloed (separate radios per department). NEXUS is the first shared intelligence layer. |
| "Can the AI be wrong?" | Yes, so every action is logged with confidence score. Operators can revert within 90s. Critical actions require human approval. |

---

## Competition Context

- **Event:** Google PromptWars Week 1, Pan India 2026 (Hack2skill × Google for Developers)
- **Challenge:** Physical Event Experience
- **Format:** Build with AI / vibe coding — judged on working demo, AI depth, Google ecosystem usage
- **Differentiator:** NEXUS is the ONLY operations-layer solution. Every other team builds a fan app.
- **Stack highlight for judges:** 9 Google products, Gemini structured JSON output, real-time Firestore, FCM push, Maps heatmap, Cloud Functions cron
- **Build timeline:** 8 days. Day 1-2: backend + AI engine. Day 3-4: ops dashboard + maps. Day 5: fan PWA. Day 6: demo mode. Day 7: deploy. Day 8: rehearse.

---

## Current Build Status

Track this section as the project progresses:

- [ ] Firebase project created (`nexus-stadium`)
- [ ] Firestore collections seeded (stadiums, crowd_density, match_events)
- [ ] Gemini API key configured
- [ ] crowdSimulator() running on Cloud Scheduler
- [ ] nexusEngine() calling Gemini and writing to nexus_actions
- [ ] OpsDashboard.jsx live with real-time Firestore data
- [ ] StadiumMap.jsx showing zone heatmap
- [ ] FanApp.jsx working as mobile PWA
- [ ] FCM push notifications firing
- [ ] DemoControls.jsx triggering scenarios
- [ ] Firebase Hosting deployed
- [ ] Demo rehearsed 5+ times
