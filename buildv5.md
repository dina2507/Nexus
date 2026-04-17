# NEXUS buildv5 — Fan App Completion & Bug Fixes

## Current State Assessment

The core engine (Gemini, crowd sim, FCM) is solid. The fan app has 3 critical bugs
that break its primary flows, plus several incomplete features that weaken the demo.

---

## Critical Bugs (break core flows)

### BUG-1: mintVoucher returns 403 for all fan users
**File:** `functions/index.js:252`, `functions/middleware/auth.js`  
**Problem:** `mintVoucher` uses `requireOperator` middleware which checks
`operators/{uid}` in Firestore. Anonymous fan users have no operator doc → 403.
This means **no fan ever receives a valid voucher QR**. The entire voucher flow is broken.  
**Fix:** Create `requireAnyAuth` middleware (token valid = pass). `mintVoucher` only
needs proof of identity, not operator role. Action ownership check inside the function
is sufficient security.

### BUG-2: "Route me" button does nothing
**File:** `src/pages/FanApp.jsx:306`  
**Problem:** The "Route me" CTA button in the notification overlay has no `onClick`
handler. Pressing it does nothing.  
**Fix:** `onClick` should switch `activeTab` to `'navigate'` and dismiss the
notification so the fan sees their route.

### BUG-3: Fan actions query re-subscribes on every notification
**File:** `src/pages/FanApp.jsx:132`  
**Problem:** `notification` is in the `useEffect` deps array for the Firestore query.
Every time a notification is set, the query tears down and resubscribes, which can
trigger another notification, causing a re-subscribe loop.  
**Fix:** Remove `notification` from the deps array. The query only needs to resubscribe
when `fanProfile?.zone_id` or `uid` changes.

---

## Important Fixes

### FIX-4: FanSeatTab stale zoneId state
**File:** `src/components/FanSeatTab.jsx:11`  
**Problem:** `zoneId` is initialized via `useState(fanProfile?.zone_id)` at mount.
If `fanProfile` loads asynchronously after mount (which it always does), the dropdown
shows `north_stand` regardless of the fan's actual zone.  
**Fix:** Add a `useEffect` that syncs `zoneId` whenever `fanProfile?.zone_id` changes.

### FIX-5: concourse_b zone missing from StadiumMap
**File:** `src/components/StadiumMap.jsx`  
**Problem:** `FanSeatTab` has `concourse_b` as a selectable zone, but it has no entry
in `STADIUM_ZONES` (SVG) or `ZONES_DATA` (Google Maps). A fan who selects concourse_b
will see 0% on the map and get no routing.  
**Fix:** Add `concourse_b` polygon coordinates to both `STADIUM_ZONES` and `ZONES_DATA`.

### FIX-6: Firestore rules — nexus_actions allows full field overwrite
**File:** `firestore.rules:12`  
**Problem:** `allow update: if request.auth != null` lets any authenticated user
overwrite any field on any action (action text, priority, confidence, etc.).  
**Fix:** Restrict to only `status` and `resolved_at` fields using `affectedKeys().hasOnly(...)`.

### FIX-7: mintVoucher allows infinite mints per fan+action
**File:** `functions/index.js:252`  
**Problem:** Each call to `mintVoucher` generates a new `jti` with `Date.now()`,
so the same fan can mint unlimited JWTs for the same action. `redeemVoucher` only
prevents double-redemption of the same `jti`, not multiple mints.  
**Fix:** Write an idempotency record to `voucher_mints/{actionId}_{uid}` before minting.
If it already exists, return the cached token.

---

## Fan App Feature Gaps

### GAP-8: FanLiveTab has no zone density display
**File:** `src/components/FanLiveTab.jsx`  
**Problem:** The buildv3 spec required a "Your Zone — live" density card with visual
indicator. Currently FanLiveTab shows only match score + recent alerts.  
**Fix:** Add a zone density card above the match card, showing `myZoneDensity` as a
visual progress bar with colour thresholds (green/amber/red) and a status label.

### GAP-9: FanLiveTab needs density from parent
**File:** `src/pages/FanApp.jsx:213`, `src/components/FanLiveTab.jsx`  
**Problem:** `myZoneDensity` and `densities` are in `FanApp` but not passed to `FanLiveTab`.  
**Fix:** Pass `myZoneDensity` and `densities` as props to `FanLiveTab`.

### GAP-10: Match header hardcoded
**File:** `src/pages/FanApp.jsx:191`, `src/pages/MatchReport.jsx`  
**Problem:** "CSK vs MI" and "MA Chidambaram Stadium · IPL 2026" are hardcoded strings.  
**Fix:** Read team names and venue from `matchState` (or `stadium`) if the fields exist,
fall back to the hardcoded strings.

### GAP-11: FanNavigateTab zone density indicator missing
**File:** `src/components/FanNavigateTab.jsx`  
**Problem:** Navigate tab shows routing steps but no visual density context —
the fan doesn't know how crowded their zone is or how bad it is vs nearby zones.  
**Fix:** Add a compact density badge for current zone (colour-coded) and the
estimated wait time calculation already in the code (`waitTime`) as a pill.

---

## Implementation Order

1. **BUG-1** — `requireAnyAuth` middleware + update `mintVoucher` (unblocks voucher flow)
2. **BUG-2** — Wire "Route me" onClick (one-liner, high impact)
3. **BUG-3** — Remove `notification` from deps array (prevents subscription loop)
4. **FIX-4** — FanSeatTab useEffect sync
5. **FIX-5** — Add concourse_b to StadiumMap
6. **FIX-6** — Firestore rules field restriction
7. **FIX-7** — mintVoucher idempotency
8. **GAP-8/9** — FanLiveTab zone density card + pass props
9. **GAP-10** — Dynamic match header
10. **GAP-11** — FanNavigateTab density badge

---

## What's Complete (do not rework)

- Gemini 2.0 Flash engine (JSON mode, throttle, fallback, timeout)
- Crowd/weather/ticket-scan simulators (all crons)
- Human-in-loop ApprovalQueue (60s countdown, auto-escalate)
- Operator pause kill-switch (Firestore-synced)
- Emergency broadcast (FCM multicast, admin-only with confirmCode)
- 4 demo scenarios fully wired (halftime, gate_emergency, postmatch, reset)
- StadiumMap SVG fallback with Google Maps primary
- ImpactChart (density_log driven, before/after curve)
- MatchReport with PDF export
- Server-signed JWT voucher system (mint + redeem + replay prevention)
- Multi-stadium support (StadiumPicker, localStorage)
- Role-based auth on all Cloud Functions (requireOperator middleware)
- FCM foreground + background handlers
