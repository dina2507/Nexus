# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**NEXUS** — AI-powered stadium crowd management for MA Chidambaram Stadium, Chennai. Real-time crowd simulation → Gemini 2.0 Flash decisions → coordinated 5-stakeholder actions → fan push notifications. Firebase project: `prompt-wars-492706`.

## Commands

### Frontend (root)
```bash
npm run dev        # Vite dev server on :5173
npm run build      # Production build → dist/
npm run lint       # ESLint (flat config, v9)
npm run preview    # Preview production build
```

### Cloud Functions
```bash
cd functions
npm run serve      # Local emulator (firebase emulators:start --only functions)
npm run deploy     # Deploy to Firebase
npm run logs       # Stream function logs
```

### Firestore Seeding
```bash
node scripts/seedFirestore.cjs   # Use the .cjs version — requires GOOGLE_APPLICATION_CREDENTIALS env var
```

### Deployment
```bash
firebase deploy --only functions          # Functions only
firebase deploy --only hosting            # Frontend only
firebase deploy                           # Everything
```

## Architecture

### Data Flow

```
crowdSimulatorCron (every 1 min, runs twice = 30s cadence)
  └→ writes crowd_density/{zoneId} + appends match_events/current.density_log
       └→ triggers nexusOnCrowdUpdate (if any zone pct ≥ 0.80)
            └→ nexusEngine.js: reads state → Gemini 2.0 Flash (JSON mode) → batch writes nexus_actions/
                 └→ priority ≥ 4 → status:"pending" (human approval required)
                    priority < 4 → status:"dispatched" (auto-dispatched)
                 └→ decrements match_events/current.remaining_budget if fan incentive fires
                 └→ sendFanNudge() → FCM multicast to fan_profiles tokens
```

Manual triggers: `POST /nexusTrigger` with `{ scenario }` (demo) or `{ manualAction }` (operator override, skips Gemini).

### Frontend State

`NexusContext` (src/context/NexusContext.jsx) holds all real-time state via four `onSnapshot` listeners:
- `stadiums/{VITE_STADIUM_ID}` → stadium config (zones, thresholds, incentive config)
- `match_events/current` → live match state
- `crowd_density` filtered by stadium_id → zone densities
- `nexus_actions` filtered by stadium_id, last 20 desc → action feed

All pages consume this via `useNexus()`.

### Routes
| Path | Component | Auth |
|---|---|---|
| `/` | OpsDashboard | Google Sign-in + operators/{uid} Firestore role check |
| `/fan` | FanApp | Public (anonymous FCM sign-in) |
| `/demo` | DemoControls | Public |
| `/report` | MatchReport | Public |

### Firestore Schema

| Collection | Key fields |
|---|---|
| `stadiums/{id}` | `crush_threshold` (0.82), `critical_threshold` (0.93), `zones[]`, `incentive_config` |
| `crowd_density/{zoneId}` | `pct` (0–1), `stadium_id`, `updated_at` |
| `match_events/current` | `match_minute`, `mins_to_halftime`, `remaining_budget`, `density_log[]` |
| `nexus_actions/{id}` | `stakeholder`, `action`, `priority`, `status`, `stadium_id`, `confidence` |
| `fan_profiles/{uid}` | `fcm_token`, `stadium_id`, `section`, `tier`, `seat`, `gate`, `zone_id` |
| `operators/{uid}` | `role` ("admin"\|"viewer"), `stadiumId` |
| `nexus_state/engine` | `last_call`, `last_budget_warning`, `paused`, `paused_at` |
| `historical_patterns/{stadiumId}` | `patterns[]` (label, description, outcome) — fed to Gemini for grounding |

### Key Engine Constraints

- **Pause kill-switch:** `nexus_state/engine.paused = true` short-circuits the engine *and* both simulator crons. Toggled from the OpsDashboard "Pause AI" button.
- **Gemini throttle:** 25s minimum between calls (`nexus_state/engine.last_call`). Force-bypass with `{ force: true }`.
- **Budget guard:** If `remaining_budget ≤ 0`, engine logs a system warning and zeros out fan incentive before writing.
- **Gemini fallback:** 1 retry at 500ms delay, then `buildFallbackDecision()` (rule-based).
- **Fan nudge budget:** `incentive_inr × 500` fans deducted per dispatch.
- **Human review:** Actions with `priority ≥ 4` go to `status:"pending"` → ApprovalQueue auto-escalates after 60s.
- **Historical grounding:** Engine reads `historical_patterns/{stadiumId}` and injects past-match summaries into the Gemini prompt.

## Environment Variables

**Frontend (`.env`):** All `VITE_` prefixed — Firebase config, `VITE_MAPS_KEY`, `VITE_FUNCTIONS_URL`, `VITE_VAPID_KEY`, `VITE_STADIUM_ID` (defaults to `"chepauk"`).

**Functions (`functions/.env`):** `GEMINI_API_KEY` — loaded via `dotenv` in `functions/index.js`.

## Multi-Stadium

Stadium ID is read from `VITE_STADIUM_ID` env var throughout. To add a new stadium: seed a `stadiums/{newId}` document and set `VITE_STADIUM_ID=newId`. No code changes required.

## PWA & FCM

Service worker at `public/firebase-messaging-sw.js` handles background FCM. PWA manifest + Workbox configured in `vite.config.js` via `vite-plugin-pwa`. Icons (`pwa-192x192.png`, `pwa-512x512.png`) must be placed in `public/`.

## Styling

Inline styles with CSS custom properties (defined in `src/index.css` `:root`). Tailwind 4 is available but used minimally — prefer the existing `--bg-*`, `--accent`, `--text-*`, `--success/warning/danger` tokens and shared classes (`.card`, `.badge-*`, `.btn-primary`, `.stat-card`, `.section-label`).

---

## v2.5 — Implemented in this iteration

### Performance
- Removed the 30s `setTick` interval in `OpsDashboard` that was forcing a full-tree re-render every half minute.
- `StadiumMap` is now `memo()`-wrapped with a custom `densitiesEqual` comparator — Google Maps polygons no longer re-tint when only the action feed updates.
- `ImpactChart` is `memo()`-wrapped and its derived series are `useMemo`'d against `density_log.length`.
- `mapDensities` in `OpsDashboard` is `useMemo`'d so a stable reference is passed to `StadiumMap`.

### Operator kill-switch + emergency broadcast
- New "Pause AI" toggle in the Operator Override panel writes `nexus_state/engine.paused`. `runNexusEngine` short-circuits when paused; both simulator crons also skip writes.
- New "Emergency" broadcast button posts `{ emergencyBroadcast: true }` to `nexusTrigger`. The function fans out via FCM to all `fan_profiles` for the stadium and logs a P5 system action to the feed.

### Historical patterns grounding
- `runNexusEngine` now reads `historical_patterns/{stadiumId}` in parallel with stadium/crowd/match state.
- `buildNexusPrompt` accepts an optional `historicalPatterns` arg and injects a `HISTORICAL PATTERNS` block into the Gemini prompt when present.
- Seed via `node scripts/seedHistoricalPatterns.cjs`.

### Cron split (cost control)
- `crowdSimulatorCron` no longer holds a function alive for 30s via `setTimeout`.
- Two separate scheduled functions now run: `crowdSimulatorCron` (top of minute) and `crowdSimulatorCronOffset` (still uses a small 30s delay for the half-minute mark — Cloud Scheduler granularity is 1m).
- Both check `isEnginePaused()` before writing.

### Fan app realism
- `FanApp` now loads/seeds `fan_profiles/{uid}` with a default seat (section, tier, seat, gate, zone_id). Seat card reads from this profile instead of hardcoded strings.
- The duplicate fan-actions Firestore listener is gone — there's now a single subscription that filters by `target_zone === fanProfile.zone_id`.
- "Your Zone — live" card shows the live density % for the fan's own zone, color-coded against thresholds.
- Voucher QR is rendered inside the nudge card via `api.qrserver.com` (zero new deps). Payload encodes `{ uid, zone, inr, ts }`.

### Accessibility
- `aria-label` added to override buttons, pause toggle, emergency button, fan dismiss, fan tab nav.
- `aria-pressed` on fan tab buttons.

## Outstanding (deferred to v3 — see `buildv3.md`)
- `nexusTrigger` HTTP endpoint is **still unauthenticated** — needs Firebase ID token verification.
- Zero project-level tests.
- QR generation still uses external service; v3 should swap to `qrcode.react`.
- Weather API + ticket system integration (mocked in screenshots, not built).
- Server-signed voucher payloads (currently client-built, easily forgeable).
