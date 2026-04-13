# NEXUS v2 — Build Plan

**Project:** `prompt-wars-492706` · MA Chidambaram Stadium, Chennai  
**Stack:** React 18 + Vite 6, Firebase (Firestore, Auth, FCM, Functions), Gemini 2.0 Flash, Google Maps  
**Status of v1:** Functional demo — real-time crowd simulation, AI decision engine, ops dashboard, fan app, human-in-the-loop approval queue.

---

## 1. Codebase Audit — What v1 Has

### Frontend (`src/`)
| File | Status | Notes |
|---|---|---|
| `App.jsx` | ✅ Solid | Router + NexusProvider wrapping all routes |
| `context/NexusContext.jsx` | ✅ Solid | Real-time Firestore subscriptions for match, density, actions |
| `firebase/config.js` | ✅ | All services initialized; messaging guarded behind `typeof window` |
| `firebase/collections.js` | ✅ | Clean subscription helpers + `resolveAction` |
| `pages/OpsDashboard.jsx` | ✅ Works | Match clock formatter, pressure index, sign-out; **no mobile layout** |
| `pages/FanApp.jsx` | ⚠️ Partial | FCM bootstrap + anonymous auth + mock notification; notification body is **hardcoded** |
| `pages/DemoControls.jsx` | ✅ | Scenario trigger UI calling `nexusTrigger` Cloud Function |
| `pages/MatchReport.jsx` | ✅ | Post-match summary with ImpactChart |
| `components/StadiumMap.jsx` | ⚠️ Brittle | Graceful fallback SVG when Maps key absent, but Map instance never cleaned up on re-render |
| `components/ZoneDensityBars.jsx` | ✅ | Animated bars, crush threshold marker |
| `components/ApprovalQueue.jsx` | ✅ | Auto-escalate countdown, approve/reject |
| `components/ImpactChart.jsx` | ⚠️ Static | Chart data is **fully hardcoded** — not driven by Firestore |
| `components/ActionFeed.jsx` | ⚠️ Unused | `OpsDashboard` renders its own inline feed; this component is orphaned |

### Cloud Functions (`functions/`)
| File | Status | Notes |
|---|---|---|
| `index.js` | ✅ | Three exports: `crowdSimulatorCron`, `nexusOnCrowdUpdate`, `nexusTrigger` |
| `crowdSimulator.js` | ✅ | Good time-based density model with noise + halftime surge |
| `nexusEngine.js` | ✅ | Reads state → calls Gemini → writes actions; good fallback |
| `nexusPrompt.js` | ✅ | Well-structured prompt; zone context is rich |
| `fanNudge.js` | ⚠️ Partial | Queries `fan_profiles` by `stadium_id` but field is **never written** in `FanApp.jsx` (line uses `{ merge: true }` ✓, but the query only works if FCM token registered) |

### Firestore Schema
```
stadiums/{stadiumId}          — static config (seeded)
match_events/current          — live match state (updated by cron + manual trigger)
crowd_density/{zoneId}        — pct + stadium_id + updated_at
nexus_actions/{auto-id}       — stakeholder actions, status: pending|dispatched|approved|rejected
fan_profiles/{userId}         — fcm_token, stadium_id
```

---

## 2. Bugs to Fix in v2

### Critical
1. **`StadiumMap.jsx` — Map instance leak**  
   `useEffect` creates the map but the cleanup only does `polygonsRef.current = {}`. The `google.maps.Map` instance is never destroyed. On hot-reload this causes duplicate maps.  
   **Fix:** Track the map container div and recreate only when the API key changes. Or use a stable `key` prop to force remount.

2. **`FanApp.jsx` — Hardcoded notification**  
   ```js
   const timer = setTimeout(() => { setNotification({ title: 'HALFTIME REDIRECT', ... }) }, 5000);
   ```
   This fires every time `FanApp` mounts. Replace with a Firestore listener on `nexus_actions` filtered to `stakeholder == 'fans'` and `status == 'dispatched'`.

3. **`ImpactChart.jsx` — Static data**  
   All 19 data points are hardcoded. This makes the chart meaningless in a live demo.  
   **Fix:** Store a `density_history` subcollection (or rolling array on `match_events/current`) and query the last N readings per zone.

4. **`fanNudge.js` — `zone_label` field**  
   ```js
   zone_label: fanAction.target_zone?.replace('_', ' ')
   ```
   `String.replace` only replaces the **first** underscore. `north_stand` → `north stand` ✓, but `concourse_a` → `concourse a` ✓. Edge case but `east_block` → `east block` (both fine). Still, use `replaceAll` for safety.

5. **`nexusEngine.js` — Gemini JSON parse can fail silently**  
   The `buildFallbackDecision` runs on any error, including transient network timeouts. Add a retry (1× with 500ms delay) before falling back.

### Minor
6. `ActionFeed.jsx` is imported nowhere in v1. Either wire it in or delete it.
7. `src/App.css` contains leftover Vite scaffold styles — can be deleted.
8. `scripts/seedFirestore.js` uses `applicationDefault()` which requires `GOOGLE_APPLICATION_CREDENTIALS` env var. The `.cjs` version is the one that actually works without service account. Document which one to use.

---

## 3. Feature Roadmap for v2

### 3.1 Live Density History → Drive ImpactChart

**Where:** `functions/crowdSimulator.js` + `src/components/ImpactChart.jsx`

On every `simulateCrowd` tick, append a snapshot to `match_events/current.density_log` array (cap at 40 entries = ~20 min of history):

```js
// In crowdSimulator.js, after batch.commit()
await matchRef.update({
  match_minute: matchMinute + 0.5,
  mins_to_halftime: ...,
  density_log: admin.firestore.FieldValue.arrayUnion({
    t: matchMinute,
    north_stand: zones['north_stand'],
    concourse_a: zones['concourse_a'],
    // ... all zones
  })
});
```

`ImpactChart` subscribes to `match_events/current` and renders `density_log` directly. Add a "Crush threshold" horizontal line at `stadium.crush_threshold`.

---

### 3.2 Fan Nudge → Real Firestore-driven Notifications

**Where:** `src/pages/FanApp.jsx`

Replace the `setTimeout` mock with:

```js
useEffect(() => {
  const q = query(
    collection(db, 'nexus_actions'),
    where('stakeholder', '==', 'fans'),
    where('status', '==', 'dispatched'),
    orderBy('timestamp', 'desc'),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (!snap.empty) {
      const action = snap.docs[0].data();
      setLiveNudge({
        title: `NEXUS — ${action.target_zone?.replace(/_/g, ' ').toUpperCase() || 'STADIUM'}`,
        body: action.action,
        reward: action.incentive_inr ? `₹${action.incentive_inr} VOUCHER` : 'VIEW NOW'
      });
    }
  });
}, []);
```

Remove the separate `liveNudge` state — fold it into a single `nudge` state driven by Firestore.

---

### 3.3 Mobile-Responsive OpsDashboard

The current dashboard uses a hardcoded `grid-cols-12` layout that breaks below 1024px. v2 needs:

- **Mobile (< 768px):** Single column, tabs for Map / Zones / Actions / Queue
- **Tablet (768–1200px):** Two-column: left = map + zones, right = feed + queue  
- **Desktop (> 1200px):** Current three-column layout

Use Tailwind breakpoint classes throughout — no inline `style` for layout.

---

### 3.4 Match Clock — Real-time Ticker

`formatMatchClock` runs once on render. Add a 30-second interval to re-render the clock badge:

```js
const [tick, setTick] = useState(0);
useEffect(() => {
  const id = setInterval(() => setTick(t => t + 1), 30_000);
  return () => clearInterval(id);
}, []);
```

Or better: derive the clock display from `matchState.match_minute` which is already live from Firestore.

---

### 3.5 Budget Depletion Guard

`nexusEngine.js` never checks `matchState.remaining_budget` before setting `incentive_inr`. If the budget hits zero the system should:
1. Set `fans.action = ""` and `fans.priority = 0`
2. Log a warning action with `stakeholder: "system"`

Add to `nexusEngine.js` before the Gemini call:

```js
if (matchState.remaining_budget <= 0) {
  // Override fan action in prompt: tell Gemini budget is exhausted
  // Or skip fan incentive entirely
}
```

Also wire the `remaining_budget` decrement — currently it's **never decremented** after an action fires.

---

### 3.6 Deduct Budget on Fan Action Dispatch

In `functions/nexusEngine.js`, after `batch.commit()`:

```js
const fanAction = decision.actions?.fans;
if (fanAction?.incentive_inr > 0 && fanAction.action) {
  await db.doc('match_events/current').update({
    remaining_budget: admin.firestore.FieldValue.increment(-fanAction.incentive_inr * 500) // estimated 500 fans nudged
  });
}
```

Surface the real-time budget in OpsDashboard (already wired via `matchState.remaining_budget` — just needs the decrement).

---

### 3.7 Operator Action Override

Add a quick-action panel in OpsDashboard for operators to manually dispatch an action without going through Gemini:

```
[Open Gate G8] [Call Medical Stand N] [Push Fan Nudge] [Hold Buses]
```

Each button calls `nexusTrigger` with a `manualAction` payload and skips the AI engine.

---

### 3.8 Multi-stadium Support

The system is hardcoded to `chepauk` everywhere. For v2 scalability:

- Add a `VITE_STADIUM_ID` env var
- Replace all `'chepauk'` literals with `import.meta.env.VITE_STADIUM_ID`
- `NexusContext` reads stadium config from Firestore (`stadiums/{stadiumId}`) instead of the static `chepauk.json` import

This lets the same frontend serve Wankhede, Eden Gardens, etc. with zero code changes.

---

### 3.9 Auth — Role-based Access

`ProtectedRoute.jsx` only checks Google sign-in. Add a Firestore `operators` collection:

```
operators/{uid} → { role: 'admin' | 'viewer', stadiumId: 'chepauk' }
```

Check on login. Viewers see the dashboard read-only. Admins can approve/reject. Unapproved emails see a "Access pending" screen instead of the dashboard.

---

### 3.10 PWA — Service Worker Fan Nudges

`public/firebase-messaging-sw.js` is already in place. Wire up:
1. `vite-plugin-pwa` (already installed) with a manifest entry for NEXUS Connect
2. Add `workbox-precaching` for the Fan App shell
3. Test background FCM delivery end-to-end

---

## 4. File Changes Summary

| File | Action |
|---|---|
| `functions/crowdSimulator.js` | Add `density_log` arrayUnion |
| `functions/nexusEngine.js` | Add retry, budget guard, budget decrement |
| `functions/fanNudge.js` | Fix `replaceAll` |
| `src/pages/FanApp.jsx` | Replace setTimeout with Firestore listener |
| `src/pages/OpsDashboard.jsx` | Mobile layout, live clock ticker, budget decrement display |
| `src/components/ImpactChart.jsx` | Drive from `density_log` |
| `src/components/StadiumMap.jsx` | Fix map instance leak |
| `src/components/ActionFeed.jsx` | Wire into OpsDashboard OR delete |
| `src/context/NexusContext.jsx` | Add `VITE_STADIUM_ID` env support |
| `src/firebase/collections.js` | Add `subscribeLatestFanNudge` helper |
| `src/App.css` | Delete (scaffold leftover) |

---

## 5. Environment Variables Checklist

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_MAPS_KEY=                    # Google Maps JS API key
VITE_VAPID_KEY=                   # FCM VAPID key for web push
VITE_FUNCTIONS_URL=               # Cloud Functions base URL
VITE_STADIUM_ID=chepauk           # NEW in v2

# functions/.env (not committed)
GEMINI_API_KEY=
```

---

## 6. Build Order for v2 Sprint

1. **Fix bugs** (§2) — no new features until these are clean  
2. **density_log** → ImpactChart (§3.1) — highest demo impact  
3. **Fan nudge Firestore listener** (§3.2) — closes the AI → fan loop  
4. **Budget decrement** (§3.6) — makes the ₹200,000 budget number meaningful  
5. **Mobile layout** (§3.3) — needed for fan app QR demo  
6. **Operator override panel** (§3.7) — backup for when Gemini is slow  
7. **Role-based auth** (§3.9) — for a real deployment  
8. **Multi-stadium** (§3.8) — scalability story  
9. **PWA** (§3.10) — polish  

---

*Last updated: build_v2.md — generated from full v1 codebase audit*
