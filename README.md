# NEXUS — AI-Powered Stadium Crowd Management

> **Air traffic control for a stadium.**

NEXUS (Neural Event eXperience Unified System) is an AI-powered operations coordination platform for large-scale sporting venues. It uses **Gemini 2.0 Flash** to analyze real-time crowd density and simultaneously dispatch coordinated actions to five stakeholder groups — security, medical, concessions, transport, and fans — before dangerous crowd situations form.

Built for **MA Chidambaram Stadium, Chennai** (38,000 capacity) as a demonstration for IPL 2026 match operations.

**Live Demo:** https://prompt-wars-492706.web.app

---

## The Problem

Most stadium incidents are predictable. Halftime at a cricket match is a known event — yet every stadium treats it as a surprise. Security, medical, food vendors, and transport all operate on separate radio channels with zero shared intelligence. Decisions happen reactively, minutes after a dangerous density has already formed.

NEXUS solves this by being the **shared intelligence layer** across all five stakeholder groups — acting 8 minutes before the surge forms, not 8 minutes after.

---

## How It Works

```
crowdSimulatorCron (every 30s)
  └─> writes crowd_density/{zoneId}  ← live zone density %
       └─> nexusOnCrowdUpdate fires (if any zone ≥ 80%)
            └─> Gemini 2.0 Flash analyzes stadium state
                 └─> Returns 5-stakeholder action JSON
                      ├─> priority < 4  → auto-dispatched
                      ├─> priority ≥ 4  → human approval queue (60s)
                      └─> fan actions   → FCM push notification + voucher QR
```

**Incentive tiers:**

| Zone Density | Action |
|---|---|
| Below 70% | No action |
| 70–80% | Informational nudge (no incentive) |
| 80–88% | Incentivized redirect (₹80–150 voucher) |
| 88–93% | Full 5-stakeholder coordination |
| Above 93% | Human-in-loop mandatory (60s approval gate) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS 4 |
| **AI Engine** | Gemini 2.0 Flash (JSON mode, structured output) |
| **Database** | Cloud Firestore (real-time `onSnapshot`) |
| **Functions** | Firebase Cloud Functions (Node.js 18) |
| **Scheduler** | Cloud Scheduler (30s cadence via twin crons) |
| **Auth** | Firebase Auth — Google SSO (operators), Anonymous (fans) |
| **Notifications** | Firebase Cloud Messaging (FCM multicast) |
| **Hosting** | Firebase Hosting + Vite PWA |
| **Maps** | Google Maps JavaScript API (zone heatmap overlay) |

---

## Features

### Operator Dashboard (`/`)
Requires Google Sign-in + Firestore `operators/{uid}` role check.

- **Live stadium map** — Google Maps heatmap showing real-time crowd density per zone
- **Action feed** — AI recommendations with stakeholder, priority (1–5), and confidence score
- **Approval queue** — High-priority actions (≥4) with 60-second countdown; auto-escalates if not actioned
- **Operator overrides** — Manual action dispatch that bypasses Gemini entirely
- **Pause AI** — Kill-switch that halts the engine and both simulator crons instantly
- **Emergency broadcast** — FCM push to all fans in the stadium with one click
- **Impact chart** — Density trends over the match for post-event analysis

### Fan App (`/fan`)
Public — anonymous FCM sign-in, no account required.

- **Your Zone — live** — Real-time density % for the fan's assigned zone, color-coded to thresholds
- **Push notifications** — Receives crowd-relief nudges when their zone nears threshold
- **Voucher QR** — Scannable QR code encoding `{ uid, zone, inr, timestamp }` for staff to redeem
- **Zone action timeline** — All actions dispatched to the fan's zone in the current match

### Demo (`/demo`)
Public — trigger crowd scenarios and watch the AI respond in real-time.

### Match Report (`/report`)
Public — post-match summary of AI decisions, incidents avoided, and budget spent.

---

## Gemini Decision Output

Gemini returns strict JSON (`responseMimeType: "application/json"`) — no string parsing needed:

```json
{
  "risk_assessment": "North Stand exit capacity is 320/min. At halftime 3,800 fans will attempt exit simultaneously.",
  "confidence": 0.91,
  "actions": {
    "security": { "action": "Open Gate G7 auxiliary lanes", "target": "G7", "priority": 3 },
    "fans": { "action": "Move to Stand C for ₹80 food voucher", "target_zone": "north_stand", "incentive_inr": 80, "priority": 3 },
    "concessions": { "action": "Prep 240 units at Zone B", "lead_time_mins": 6, "priority": 2 },
    "medical": { "action": "Reposition Unit 2 to NW corridor", "priority": 2 },
    "transport": { "action": "Hold 3 buses for 22 minutes", "vehicles": 3, "priority": 2 }
  }
}
```

**Fallback:** If Gemini response exceeds 2s, a rule-based `buildFallbackDecision()` fires instead. 1 retry at 500ms before fallback triggers.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Firebase CLI — `npm i -g firebase-tools`
- A Firebase project with Firestore, Functions, Hosting, and FCM enabled
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Install

```bash
git clone <repo-url>
cd nexus
npm install
cd functions && npm install && cd ..
```

### Configure Environment

**Frontend — `.env`**
```env
VITE_STADIUM_ID=chepauk
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_MAPS_KEY=...
VITE_VAPID_KEY=...
VITE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net
```

**Cloud Functions — `functions/.env`**
```env
GEMINI_API_KEY=...
VOUCHER_SECRET=...
```

### Seed Firestore

```bash
# Requires GOOGLE_APPLICATION_CREDENTIALS pointing to your service account key
node scripts/seedFirestore.cjs
node scripts/seedHistoricalPatterns.cjs   # optional — feeds Gemini historical grounding
```

### Run Locally

```bash
# Terminal 1 — frontend dev server (http://localhost:5173)
npm run dev

# Terminal 2 — Cloud Functions emulator
cd functions && npm run serve
```

---

## Deploy to Firebase

```bash
# Full deploy — functions, hosting, Firestore rules, storage rules
firebase deploy

# Selective deploys
firebase deploy --only functions
firebase deploy --only hosting

# Stream live function logs
firebase functions:log
```

### Post-Deploy Checklist

1. Add yourself to `operators/{your-uid}` in Firestore with `{ role: "admin", stadiumId: "chepauk" }`
2. Visit `/fan` to register an FCM token and test push notifications
3. Open `/demo` and trigger a scenario — watch the action feed respond
4. Verify Gemini calls appear in Cloud Functions logs

---

## Firestore Schema

| Collection | Key Fields |
|---|---|
| `stadiums/{id}` | `crush_threshold` (0.82), `critical_threshold` (0.93), `zones[]`, `incentive_config` |
| `crowd_density/{zoneId}` | `pct` (0–1), `stadium_id`, `updated_at` |
| `match_events/current` | `match_minute`, `mins_to_halftime`, `remaining_budget`, `density_log[]` |
| `nexus_actions/{id}` | `stakeholder`, `action`, `priority`, `status`, `confidence`, `stadium_id` |
| `fan_profiles/{uid}` | `fcm_token`, `zone_id`, `section`, `tier`, `seat`, `gate`, `stadium_id` |
| `operators/{uid}` | `role` (admin/viewer), `stadiumId` |
| `nexus_state/engine` | `last_call`, `paused`, `paused_at`, `last_budget_warning` |
| `historical_patterns/{stadiumId}` | `patterns[]` — injected into Gemini prompt for grounding |

---

## Multi-Stadium Support

NEXUS is stadium-agnostic. Every stadium is a Firestore document + a JSON zone config. To onboard a new venue:

1. Seed a `stadiums/{newStadiumId}` document with zone layout and thresholds
2. Set `VITE_STADIUM_ID=newStadiumId` in the frontend env
3. No code changes required

---

## Cost & Performance Safeguards

| Safeguard | Detail |
|---|---|
| **Gemini throttle** | 25s minimum between engine calls — prevents rapid-fire API spend |
| **Budget guard** | Engine zeroes out fan incentives if `remaining_budget ≤ 0` |
| **Cron split** | Two separate 1-min Cloud Scheduler functions instead of a single long-lived function |
| **React memoization** | `StadiumMap` and `ImpactChart` are `memo()`-wrapped with custom comparators |
| **FCM batching** | Multicast up to 500 fans per message |
| **Pause kill-switch** | Single Firestore write halts engine + both crons instantly |

---

## Project Structure

```
nexus/
├── src/
│   ├── pages/
│   │   ├── OpsDashboard.jsx    ← main operator screen
│   │   ├── FanApp.jsx          ← fan mobile PWA
│   │   ├── DemoControls.jsx    ← scenario trigger panel
│   │   └── MatchReport.jsx     ← post-match summary
│   ├── components/
│   │   ├── StadiumMap.jsx      ← Google Maps zone heatmap
│   │   ├── ActionFeed.jsx      ← real-time action log
│   │   ├── ApprovalQueue.jsx   ← human-in-loop panel
│   │   ├── ImpactChart.jsx     ← density trend chart
│   │   └── ZoneDensityBars.jsx
│   ├── context/
│   │   └── NexusContext.jsx    ← all real-time Firestore state (4 listeners)
│   └── index.css               ← CSS custom properties + shared classes
├── functions/
│   ├── index.js                ← Cloud Function exports
│   ├── nexusEngine.js          ← Gemini decision engine
│   └── .env                    ← API keys (not in git)
├── scripts/
│   ├── seedFirestore.cjs
│   └── seedHistoricalPatterns.cjs
├── public/
│   └── firebase-messaging-sw.js   ← FCM background handler
├── firebase.json
└── firestore.rules
```

---

## Roadmap

### v2.5 — Current
- Real-time crowd monitoring across 8 zones
- Gemini 2.0 Flash decision engine with JSON-mode output
- 5-stakeholder action coordination
- FCM push notifications with voucher QR codes
- Operator kill-switch and emergency broadcast
- Historical pattern grounding for Gemini

### v3 — Planned
- [ ] Firebase ID token verification on HTTP endpoints (currently unauthenticated)
- [ ] Server-signed voucher payloads (currently client-built)
- [ ] Unit + integration test suite
- [ ] Weather API integration
- [ ] Ticket system integration
- [ ] Operator action audit log

---

## Troubleshooting

**Functions not deploying**
Ensure `GEMINI_API_KEY` is set in `functions/.env`. Run `firebase functions:log` for details.

**Crowd events not triggering Gemini**
Check `crowd_density/{zoneId}` is updating (~30s cadence). Verify `stadiums/{id}.crush_threshold` is set (default 0.82). Check `nexus_state/engine.paused` — the kill-switch may be active.

**FCM push not arriving**
Confirm `VITE_VAPID_KEY` is set, browser notifications are allowed, and `firebase-messaging-sw.js` is registered.

**Map blank / no zone overlay**
Verify `VITE_STADIUM_ID` matches a document in the `stadiums/` collection and `VITE_MAPS_KEY` has the Maps JavaScript API enabled.

---

## License

Proprietary. Built for MA Chidambaram Stadium, Chennai.

---

Maintained by [Dinagar](mailto:dinagar2505@gmail.com)
