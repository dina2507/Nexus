# NEXUS v3 — Build Spec for Antigravity

> This document is the complete v3 build brief for an external code agent (Antigravity).
> Read **CLAUDE.md** first for the architecture overview, data model, and what's already shipped through v2.5.
> v3 finishes the gaps from the original NEXUS plan and hardens the system for a real demo.

## Project context (one-paragraph recap)

NEXUS is the AI coordination layer for a stadium. Sensors → Firestore → Gemini 2.0 Flash decides → 5 stakeholders (security/fans/concessions/medical/transport) act in lockstep → fans get push nudges. Backend = Firebase Cloud Functions. Frontend = React + Vite (root) and a fan PWA at `/fan`. Gemini is the brain; the dashboard is the cockpit; the fan app is the radio.

**Firebase project:** `prompt-wars-492706`
**Default stadium ID:** `chepauk` (read from `VITE_STADIUM_ID`)
**Already implemented through v2.5:** see "v2.5 — Implemented in this iteration" section in [CLAUDE.md](CLAUDE.md).

---

## v3 Goals (in priority order)

1. **Lock down the backend** — `nexusTrigger` is currently world-callable.
2. **Add real tests** — there are zero project-level tests today.
3. **Replace external QR with a local library** — kill the runtime dependency on `api.qrserver.com`.
4. **Server-sign fan vouchers** — current QR payload is client-built and trivially forgeable.
5. **Add Weather + Ticket System mock integrations** — both appear in the original NEXUS mockups but were never built.
6. **Build the missing "Live" and "Navigate" tabs** in the fan app — currently every tab shows the same content.
7. **Add a Match Report page that's actually populated** — `/report` route exists but pulls no data.
8. **Real Firestore security rules** — currently the project relies on Cloud Functions being trusted; client SDK writes need to be locked down.
9. **Multi-stadium UI** — the data layer supports it; the dashboard does not let you switch stadiums.
10. **CI + lint gating** — no GitHub Actions, no pre-commit hooks.

---

## 1. Backend lockdown — auth on `nexusTrigger`

**Current state:** [functions/index.js](functions/index.js) declares `exports.nexusTrigger = onRequest({ cors: true }, ...)` with **no auth check**. Anyone with the URL can:
- Trigger demo scenarios that mutate `crowd_density` and `match_events`
- Dispatch arbitrary `nexus_actions` via `manualAction`
- Fire emergency broadcasts to every fan device
- Drain the fan incentive budget

**Required:**
- Add a middleware function `requireOperator(req, res, next)` that:
  1. Reads `Authorization: Bearer <id_token>` header.
  2. Verifies the token via `admin.auth().verifyIdToken(token)`.
  3. Reads `operators/{uid}` from Firestore. If `role` is `'admin'` or `'viewer'` → allow; else 403.
  4. For destructive scenarios (`manualAction`, `emergencyBroadcast`, `gate_emergency`, `postmatch`) → require `role === 'admin'`.
- Update **all** frontend callers (`OpsDashboard.dispatchOverride`, `OpsDashboard.triggerEmergencyBroadcast`, `DemoControls.triggerScenario`) to attach `await user.getIdToken()` as a Bearer header.
- Allow `emergencyBroadcast` to **also** require an explicit `confirmCode: 'EMERGENCY'` field in the body — defense-in-depth against accidental clicks.

**Acceptance:** A `curl POST` with no auth header to `nexusTrigger` returns 401. With a valid viewer token but `manualAction` set → 403. With an admin token → 200.

---

## 2. Tests (the biggest scoring gap)

Use **Vitest** for the frontend and **Jest** for Cloud Functions (Jest is already in `functions/node_modules`).

### 2a. Cloud Functions unit tests
Create `functions/__tests__/`:

- `nexusEngine.test.js`
  - `runNexusEngine` returns `{ skipped: true, reason: 'Paused' }` when `nexus_state/engine.paused === true`.
  - Throttle: two calls within 25s → second returns `{ skipped: true, reason: 'Throttled' }`.
  - Throttle bypass: `{ force: true }` ignores the throttle.
  - Budget guard: when `remaining_budget <= 0`, the engine writes a system warning and overrides `decision.actions.fans.incentive_inr = 0`.
  - Fallback: when Gemini throws twice, `buildFallbackDecision` is used and actions are still written.
  - Action priority: any action with `priority >= 4` is written with `status: 'pending'`; lower priorities → `'dispatched'`.
- `buildFallbackDecision.test.js` — extract the function (export it from nexusEngine), then test with handcrafted crowd states. The hottest zone should appear in all 5 stakeholder actions.
- `nexusPrompt.test.js`
  - When `historicalPatterns` is omitted, the prompt does NOT contain "HISTORICAL PATTERNS".
  - When `historicalPatterns.patterns` has 3 entries, all three labels appear in the prompt.
  - Zone capacity counts are computed correctly.
- `nexusTrigger.integration.test.js` (using `firebase-functions-test`)
  - `emergencyBroadcast` with no auth → 401.
  - `emergencyBroadcast` with admin auth → 200, writes a P5 system action.
  - `manualAction` with viewer auth → 403.

### 2b. Frontend component tests (Vitest + @testing-library/react)
Create `src/__tests__/`:

- `ApprovalQueue.test.jsx`
  - Renders empty state when no pending actions.
  - Renders a `PendingCard` per pending action.
  - Countdown reaches 0 → calls `onApprove` (use vi.useFakeTimers).
  - **Fix the existing stale-closure bug:** `PendingCard`'s countdown `useEffect` doesn't list `onApprove` in its deps. Test that resolving a card and getting a new one with a different `onApprove` calls the right one.
- `OpsDashboard.test.jsx`
  - Pause toggle writes `nexus_state/engine.paused` (mock Firestore).
  - Emergency button is gated behind `window.confirm`.
  - Pressure index color flips at thresholds (5.0 → warning, 7.0 → danger).
- `FanApp.test.jsx`
  - Seat card reads from `fan_profiles/{uid}` and renders fallback if profile missing.
  - Notification with `incentive_inr > 0` renders the QR image; `incentive_inr === 0` does not.
  - Notifications targeting a different `target_zone` are filtered out.

### 2c. NPM scripts
Add to root [package.json](package.json):
```json
"test": "vitest run",
"test:watch": "vitest"
```
Add to [functions/package.json](functions/package.json):
```json
"test": "jest"
```

**Acceptance:** `npm test` from the root runs Vitest with ≥10 passing tests. `cd functions && npm test` runs Jest with ≥8 passing tests.

---

## 3. Local QR generation

**Current state:** [src/pages/FanApp.jsx](src/pages/FanApp.jsx) `qrImageUrl()` builds a URL pointing at `api.qrserver.com`. Free, but: external dependency, no offline support, leaks payload to a third party.

**Required:**
- `npm install qrcode.react` in the root package.
- Replace the `<img>` in the notification overlay with `<QRCodeSVG value={voucherPayload} size={80} bgColor="#ffffff" fgColor="#0a0f1e" level="M" />`.
- Delete the `qrImageUrl` helper.
- The fan app must work fully offline once the SW caches the bundle.

**Acceptance:** Open DevTools → Network → block `api.qrserver.com` → trigger a fan nudge → QR still renders.

---

## 4. Server-signed vouchers

**Current state:** Voucher payload is built client-side in `buildVoucherPayload()`. Anyone can edit `inr` to `99999`.

**Required:**
- New Cloud Function: `mintVoucher` (HTTPS callable). Takes `{ actionId }`, looks up the action, verifies it's a fan-targeted dispatched action, and returns a JWT signed with a server secret:
  ```
  payload = { uid, action_id, zone, inr, exp: now + 3600 }
  signature = HMAC-SHA256(payload, FUNCTIONS_VOUCHER_SECRET)
  ```
- Store the secret in `functions/.env` as `VOUCHER_SECRET=<random_32_bytes_base64>`.
- Frontend: when a fan nudge arrives, call `mintVoucher` and put the returned JWT into the QR (instead of the client-built payload).
- New Cloud Function: `redeemVoucher` (HTTPS callable). Verifies the JWT, decrements the action's `redemption_count`, and refuses replays via a `voucher_redemptions/{jwt_jti}` doc.
- Document the flow in CLAUDE.md.

**Acceptance:** Forging a QR client-side (changing `inr` to 99999) → `redeemVoucher` returns "Invalid signature".

---

## 5. Weather + Ticket System mock integrations

The original mockup [shows](buildv3.md) "Weather API" and "Ticket system" feeding the AI core. They were never wired.

### 5a. Weather
- New Cloud Function `weatherSimulatorCron` (every 5 minutes) writes to `weather/{stadiumId}`:
  ```
  { temp_c, humidity, wind_kmh, precip_mm, condition: 'clear'|'cloudy'|'rain', updated_at }
  ```
- Drive it with a sine-ish function around match minute so it changes during the demo.
- `runNexusEngine` should read this in the parallel `Promise.all` and pass it to `buildNexusPrompt`. Add a `WEATHER` block to the prompt ("If precip > 5mm, expect concourse rush").
- `OpsDashboard` header gets a small weather pill next to the score.

### 5b. Ticket system
- New Firestore collection `ticket_scans/{scanId}` with `{ gate, timestamp, seat_id }`.
- New Cloud Function `ticketScanSimulator` (every 1 minute) generates 30-100 random scans across gates, weighted by match minute (heavy ramp pre-match, sparse during play, surge at halftime).
- Aggregate: a Firestore trigger computes `gates/{gateId}.scan_rate_per_min` rolling 5-minute window.
- `runNexusEngine` reads `gates/*` in the state read and includes a `GATE THROUGHPUT` block in the prompt.
- New panel in `OpsDashboard`: "Gate Activity" showing scan rates per gate.

**Acceptance:** Weather pill changes during a demo run. Gate Activity panel shows live scan-rate bars.

---

## 6. Fan app — finish the missing tabs

**Current state:** [src/pages/FanApp.jsx](src/pages/FanApp.jsx) renders three tab buttons (Navigate / Live / My Seat) but `activeTab` doesn't actually swap content.

### 6a. Navigate tab (default)
- Mini stadium SVG showing the fan's zone highlighted.
- Step-by-step exit route: "Exit your row → walk left → take stairs B → exit gate G7 (4 min wait)".
- Compute "best gate" by finding the gate adjacent to the fan's zone with the lowest density, refreshed live.
- "Get me out fast" button which, when pressed, posts a manual action requesting a fan nudge for the user's zone.

### 6b. Live tab
- Live match score pulled from `match_events/current`.
- A small density-over-time sparkline for the fan's zone (use `density_log[]`, filter to the fan's zone).
- Timeline of public NEXUS actions affecting the fan's zone.
- "Send haptic alert" toggle (browser vibration API).

### 6c. My Seat tab
- The current seat card, expanded.
- Demographic settings: language, accessibility needs (mobility, hearing).
- Emergency contact field.
- "Update my seat" form so demo users can change zones.

**Acceptance:** Tapping each tab shows distinct content, none of it blank.

---

## 7. Match Report page

**Current state:** [src/pages/MatchReport.jsx](src/pages/MatchReport.jsx) exists at route `/report` but is mostly empty.

**Required — render a post-match recap:**
- Total actions taken, broken down by stakeholder.
- Average AI confidence over the match.
- Peak density timeline (with NEXUS vs without — already in `ImpactChart`, reuse).
- Total budget spent.
- Approvals: how many P4+ actions, how many auto-escalated.
- Top 3 NEXUS interventions by impact.
- Export to PDF button (use `react-to-pdf` or `html2canvas`).

All data comes from existing collections — no new Firestore writes required.

**Acceptance:** Run the postmatch demo scenario, then open `/report` — see a populated single-page recap.

---

## 8. Firestore security rules

**Current state:** No `firestore.rules` file checked in (or it's empty).

**Required — a `firestore.rules` file at the project root:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    // Stadiums: anyone signed in can read. Only admins can write.
    match /stadiums/{stadiumId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/$(db)/documents/operators/$(request.auth.uid)).data.role == 'admin';
    }

    // Crowd density, match events, nexus actions, historical patterns:
    // read for any signed-in user. Writes ONLY from Cloud Functions
    // (use a privileged service account; client writes are forbidden).
    match /crowd_density/{zone}      { allow read: if request.auth != null; allow write: if false; }
    match /match_events/{doc}        { allow read: if request.auth != null; allow write: if false; }
    match /nexus_actions/{action}    {
      allow read: if request.auth != null;
      // Only operators may approve/reject (status field updates)
      allow update: if request.auth != null
        && exists(/databases/$(db)/documents/operators/$(request.auth.uid))
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'resolved_at']);
      allow create, delete: if false;
    }
    match /historical_patterns/{stadiumId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /nexus_state/{doc} {
      allow read: if request.auth != null;
      // Pause toggle: only admins
      allow write: if request.auth != null
        && get(/databases/$(db)/documents/operators/$(request.auth.uid)).data.role == 'admin';
    }

    // Fan profiles: a fan can only read/write their own.
    match /fan_profiles/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Operators: a user can read their own operator doc to determine role.
    match /operators/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // managed via admin script
    }
  }
}
```

Deploy with `firebase deploy --only firestore:rules`.

**Acceptance:** Open the Firebase console rules playground → an unauthenticated read of `crowd_density` is denied. A signed-in fan can't read another fan's profile. A signed-in viewer can't toggle `nexus_state/engine.paused`.

---

## 9. Multi-stadium UI

**Current state:** Stadium ID is a build-time env var (`VITE_STADIUM_ID`). The data layer supports multi-stadium but the UI is single-tenant.

**Required:**
- New `StadiumPicker` component in the `OpsDashboard` header — dropdown listing all docs in `stadiums/`.
- Selection persists to `localStorage('nexus.activeStadium')`.
- `NexusContext` reads from this state instead of `import.meta.env.VITE_STADIUM_ID`.
- All listeners re-subscribe when stadium changes.
- `crowdSimulatorCron` should iterate all `stadiums/*` docs instead of hardcoding `'chepauk'`.

**Acceptance:** Seed a second stadium (`stadiums/wankhede` with the same shape). The dropdown shows both. Switching live re-targets all panels and the impact chart.

---

## 10. CI + lint gating

- New `.github/workflows/ci.yml`:
  - Node 20.
  - Steps: `npm ci` → `npm run lint` → `npm test` → `npm run build`.
  - Same for `functions/` directory.
- New `.husky/pre-commit` hook: `npm run lint` and `npm test` on staged files only.

**Acceptance:** A PR with a failing test or lint error is blocked.

---

## Stretch goals (only after 1–10)

### S1. Real Gemini structured output via JSON schema
The current prompt asks for JSON in plain English. Switch to Gemini's `responseSchema` config and validate with Zod on receipt. This makes the engine more robust to prompt drift.

### S2. Replace simulator with a record/replay system
Today's simulator is deterministic-ish via match minute. Add a `record_match` mode that captures real `crowd_density` writes to a JSON file, and a `replay_match` mode that replays them back. Useful for reproducible demos.

### S3. Operator multi-tenant invites
Admin can invite a viewer by email → creates a pending `operators/{uid}` doc → the invitee signs in and gets auto-promoted. Currently you have to grant via `scripts/grant_admin.js` manually.

### S4. Slack / Teams webhook bridge
Fire a webhook from the engine for every P4+ action so off-shift ops staff get pinged.

### S5. Zone forecasting via Gemini
Every 5 minutes, ask Gemini "based on density_log[], project the next 10 minutes per zone". Render a forecast strip on each zone bar.

---

## File-by-file v3 deliverables checklist

| File | Action |
|---|---|
| `functions/middleware/auth.js` | NEW — `requireOperator` middleware |
| `functions/index.js` | UPDATE — wrap `nexusTrigger` with `requireOperator`; add `mintVoucher`, `redeemVoucher`, `weatherSimulatorCron`, `ticketScanSimulator` exports; iterate stadiums in cron |
| `functions/voucher.js` | NEW — JWT mint/verify helpers |
| `functions/weatherSimulator.js` | NEW |
| `functions/ticketScanSimulator.js` | NEW |
| `functions/__tests__/` | NEW — Jest test suite |
| `functions/package.json` | UPDATE — add `"test": "jest"` and jest config |
| `firestore.rules` | NEW — see section 8 |
| `firebase.json` | UPDATE — point to `firestore.rules` |
| `.github/workflows/ci.yml` | NEW |
| `.husky/pre-commit` | NEW |
| `package.json` | UPDATE — add `vitest`, `@testing-library/react`, `qrcode.react`, `react-to-pdf` |
| `vitest.config.js` | NEW |
| `src/__tests__/` | NEW — Vitest suite |
| `src/components/StadiumPicker.jsx` | NEW |
| `src/context/NexusContext.jsx` | UPDATE — read active stadium from localStorage; resubscribe on change |
| `src/components/auth.js` | NEW — helper to attach ID token to fetch calls |
| `src/pages/OpsDashboard.jsx` | UPDATE — wire StadiumPicker, weather pill, gate activity panel; route override fetches through auth helper |
| `src/pages/DemoControls.jsx` | UPDATE — auth header on fetches |
| `src/pages/FanApp.jsx` | UPDATE — finish Navigate/Live/My Seat tabs; switch to qrcode.react; call mintVoucher |
| `src/pages/MatchReport.jsx` | REBUILD per section 7 |
| `src/components/GateActivityPanel.jsx` | NEW |
| `src/components/WeatherPill.jsx` | NEW |
| `src/components/FanNavigateTab.jsx` | NEW |
| `src/components/FanLiveTab.jsx` | NEW |
| `src/components/FanSeatTab.jsx` | NEW |
| `scripts/seedAllStadiums.cjs` | NEW — seed `stadiums/wankhede` for multi-stadium demo |

---

## Out of scope for v3 (do not build)

- Real BLE beacon ingestion (the simulator is the contract for the hackathon)
- Native iOS/Android apps (PWA only)
- Payment gateway integration (vouchers are display-only)
- Real police/EMS dispatch hookups
- Computer vision crowd counting
- Multi-language translations beyond a single demo locale

---

## Demo script (what success looks like at the end of v3)

1. **Operator opens `/`** → signs in with Google → role check passes → dashboard loads in <2s.
2. **Stadium picker** shows two stadiums → Chepauk selected.
3. **Live state** populated within 500ms of dashboard load.
4. **Demo controls** at `/demo` → operator clicks "Simulate halftime surge".
5. **Within 3 seconds**: North Stand bar turns red, AI Risk Assessment populates, 5 stakeholder actions appear in the Response Feed, Approval Queue gets one P4 item with a 60s countdown, fan device receives push notification with a QR-code voucher.
6. **Operator hits "Pause AI"** → simulator continues but no new Gemini calls fire (verify in logs).
7. **Operator hits "Emergency"** → confirm dialog → all fan devices receive emergency broadcast → P5 entry in feed.
8. **Operator clicks "Final whistle"** → all zones spike → fan app shows live density rising in their zone tile.
9. **Operator opens `/report`** → sees the populated post-match recap → exports to PDF.

If all 9 steps work end-to-end on first run, v3 is shipped.
