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
                      ├─> AI Autonomy: All actions auto-dispatched
                      └─> fan actions → FCM push notification + signed JWT voucher
```

**Incentive tiers:**

| Zone Density | Action |
|---|---|
| Below 70% | No action |
| 70–80% | Informational nudge (no incentive) |
| 80–88% | Incentivized redirect (₹80–150 voucher) |
| 88–93% | Full 5-stakeholder coordination (Autonomous) |
| Above 93% | Critical coordination + Emergency protocols |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS 4, Framer Motion |
| **AI Engine** | Gemini 2.0 Flash (JSON mode, structured output) |
| **Database** | Cloud Firestore (real-time `onSnapshot`) |
| **Functions** | Firebase Cloud Functions v2 (Node.js 24) |
| **Scheduler** | Cloud Scheduler (30s cadence via twin crons) |
| **Auth** | Firebase Auth — Google SSO (operators), Anonymous (fans) |
| **Security** | JWT-signed vouchers, ID Token middleware on HTTP endpoints |
| **Notifications** | Firebase Cloud Messaging (FCM multicast) |
| **Hosting** | Firebase Hosting + Vite PWA |
| **Maps** | Google Maps JavaScript API (zone heatmap overlay) |

---

## Features

### Operator Dashboard (`/`)
Requires Google Sign-in + Firestore `operators/{uid}` role check.

- **Live stadium map** — Google Maps heatmap showing real-time crowd density per zone.
- **Action feed** — AI recommendations with stakeholder, priority (1–5), and confidence score.
- **Voucher Redemption** — Secure tool for staff to validate and redeem fan vouchers via JWT token strings.
- **Audit Log** — Every manual override and emergency broadcast is logged to `audit_logs` for transparency.
- **Operator overrides** — Manual action dispatch that bypasses Gemini entirely.
- **Pause AI** — Kill-switch that halts the engine and simulator instantly.
- **Emergency broadcast** — FCM push to all fans in the stadium with one click.

### Fan App (`/fan`)
Public — anonymous FCM sign-in, no account required.

- **Your Zone — live** — Real-time density % for the fan's assigned zone.
- **Push notifications** — Receives crowd-relief nudges when their zone nears threshold.
- **Secure Vouchers** — JWT-signed vouchers encoding `{ uid, inr, exp }` to prevent tampering.
- **Route me** — Dynamic pathfinding to redirect fans from congested areas.

### Demo (`/demo`)
Authenticated — trigger crowd scenarios (Halftime Surge, Gate Blocked, Exit Surge) and watch the AI cascade in real-time.

---

## Security & Reliability

| Measure | Detail |
|---|---|
| **Autonomous AI** | Human-in-the-loop is removed for v3. AI dispatches all decisions immediately for maximum response speed. |
| **Audit Logging** | All manual interventions are logged with Operator UID and timestamp. |
| **Token Verification** | All HTTP trigger endpoints require a valid Firebase ID Token (Operator Auth). |
| **JWT Vouchers** | Vouchers are minted with a server-side secret, making them impossible for fans to fake. |
| **Fallback Logic** | If Gemini response exceeds 8s, a rule-based engine (`buildFallbackDecision`) takes over. |

---

## Quick Start

### Prerequisites

- Node.js 24+
- Firebase CLI — `npm i -g firebase-tools`
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
VITE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net
VITE_VAPID_KEY=...
```

**Cloud Functions — `functions/.env`**
```env
GEMINI_API_KEY=...
VOUCHER_SECRET=...
```

### Run Locally

```bash
# Terminal 1 — frontend (http://localhost:5173)
npm run dev

# Terminal 2 — Cloud Functions emulator
cd functions && npm run serve
```

---

## Roadmap

### v3 — Finalized (Current)
- [x] Firebase ID token verification on HTTP endpoints
- [x] Server-signed JWT vouchers
- [x] Unit + integration test suite (Vitest + Jest)
- [x] Ticket system simulator (burst logic)
- [x] Operator action audit log
- [x] Voucher redemption tool
- [x] Full AI Autonomy (Removed HIL)

### v4 — Future
- [ ] Predictive AI (predicting surges 15 mins in advance via RAG)
- [ ] Multi-venue cluster support
- [ ] Historical grounding RAG integration

---

## License

Proprietary. Built for MA Chidambaram Stadium, Chennai.

Maintained by [Dinagar](mailto:dinagar2505@gmail.com)
