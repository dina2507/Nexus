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
| `fan_profiles/{uid}` | `fcm_token`, `stadium_id` |
| `operators/{uid}` | `role` ("admin"\|"viewer"), `stadiumId` |

### Key Engine Constraints

- **Gemini throttle:** 25s minimum between calls (`nexus_state/engine.last_call`). Force-bypass with `{ force: true }`.
- **Budget guard:** If `remaining_budget ≤ 0`, engine logs a system warning and zeros out fan incentive before writing.
- **Gemini fallback:** 1 retry at 500ms delay, then `buildFallbackDecision()` (rule-based).
- **Fan nudge budget:** `incentive_inr × 500` fans deducted per dispatch.
- **Human review:** Actions with `priority ≥ 4` go to `status:"pending"` → ApprovalQueue auto-escalates after 60s.

## Environment Variables

**Frontend (`.env`):** All `VITE_` prefixed — Firebase config, `VITE_MAPS_KEY`, `VITE_FUNCTIONS_URL`, `VITE_VAPID_KEY`, `VITE_STADIUM_ID` (defaults to `"chepauk"`).

**Functions (`functions/.env`):** `GEMINI_API_KEY` — loaded via `dotenv` in `functions/index.js`.

## Multi-Stadium

Stadium ID is read from `VITE_STADIUM_ID` env var throughout. To add a new stadium: seed a `stadiums/{newId}` document and set `VITE_STADIUM_ID=newId`. No code changes required.

## PWA & FCM

Service worker at `public/firebase-messaging-sw.js` handles background FCM. PWA manifest + Workbox configured in `vite.config.js` via `vite-plugin-pwa`. Icons (`pwa-192x192.png`, `pwa-512x512.png`) must be placed in `public/`.

## Styling

Inline styles with CSS custom properties (defined in `src/index.css` `:root`). Tailwind 4 is available but used minimally — prefer the existing `--bg-*`, `--accent`, `--text-*`, `--success/warning/danger` tokens and shared classes (`.card`, `.badge-*`, `.btn-primary`, `.stat-card`, `.section-label`).
