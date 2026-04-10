# NEXUS — Developer Instructions & Reference
## Quick-access guide for active development

---

## Environment Setup

### Required API Keys (.env file)
```
VITE_GEMINI_KEY=your_gemini_api_key
VITE_MAPS_KEY=your_maps_api_key
VITE_FIREBASE_API_KEY=from_firebase_console
VITE_FIREBASE_AUTH_DOMAIN=nexus-stadium.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=nexus-stadium
VITE_FIREBASE_STORAGE_BUCKET=nexus-stadium.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Where to get each key
- Gemini API key → aistudio.google.com → Get API Key
- Maps API key → console.cloud.google.com → APIs & Services → Credentials
- Firebase config → console.firebase.google.com → Project Settings → Web App

### Install commands
```bash
# Frontend
npm create vite@latest nexus -- --template react
cd nexus
npm install firebase @google/generative-ai @googlemaps/js-api-loader chart.js vite-plugin-pwa

# Functions
cd functions
npm install firebase-admin firebase-functions @google/generative-ai

# CLI tools
npm install -g firebase-tools
firebase login
firebase init  # select: Firestore, Functions, Hosting, Storage
```

---

## Firebase Initialization (src/firebase/config.js)

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);
export const analytics = getAnalytics(app);
```

---

## Core Firestore Hooks (src/firebase/collections.js)

```javascript
import { collection, doc, onSnapshot, query,
         orderBy, limit, where, updateDoc } from 'firebase/firestore';
import { db } from './config';

// Real-time crowd density for all zones
export function subscribeCrowdDensity(stadiumId, callback) {
  const q = query(
    collection(db, 'crowd_density'),
    where('stadium_id', '==', stadiumId)
  );
  return onSnapshot(q, snap => {
    const data = {};
    snap.forEach(doc => data[doc.id] = doc.data());
    callback(data);
  });
}

// Real-time action feed (last 20 actions)
export function subscribeActions(stadiumId, callback) {
  const q = query(
    collection(db, 'nexus_actions'),
    where('stadium_id', '==', stadiumId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Approve or reject a pending action
export async function resolveAction(actionId, decision) {
  await updateDoc(doc(db, 'nexus_actions', actionId), {
    status: decision, // 'approved' or 'rejected'
    resolved_at: new Date().toISOString()
  });
}

// Real-time pending actions for human review
export function subscribePendingActions(stadiumId, callback) {
  const q = query(
    collection(db, 'nexus_actions'),
    where('stadium_id', '==', stadiumId),
    where('status', '==', 'pending'),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
```

---

## Gemini Decision Engine (functions/nexusEngine.js)

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import { buildNexusPrompt } from './nexusPrompt.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: { responseMimeType: 'application/json' }
});

export async function runNexusEngine(stadiumId = 'chepauk') {
  const db = admin.firestore();

  // Read state in parallel
  const [stadiumDoc, crowdSnap, matchDoc] = await Promise.all([
    db.doc(`stadiums/${stadiumId}`).get(),
    db.collection('crowd_density')
      .where('stadium_id', '==', stadiumId).get(),
    db.doc('match_events/current').get()
  ]);

  const stadium = stadiumDoc.data();
  const crowdState = {};
  crowdSnap.forEach(doc => crowdState[doc.id] = doc.data());
  const matchState = matchDoc.data();

  // Only fire if there's a risk worth acting on
  const hasRisk = Object.values(crowdState)
    .some(z => z.pct >= stadium.crush_threshold)
    || matchState.mins_to_halftime <= 10;

  if (!hasRisk) return { skipped: true, reason: 'No zones at threshold' };

  // Call Gemini
  const prompt = buildNexusPrompt(stadium, crowdState, matchState);
  const result = await model.generateContent(prompt);
  const decision = JSON.parse(result.response.text());

  // Write all actions atomically
  const batch = db.batch();
  const timestamp = new Date().toISOString();

  Object.entries(decision.actions).forEach(([stakeholder, action]) => {
    if (!action.action) return;
    const ref = db.collection('nexus_actions').doc();
    batch.set(ref, {
      stakeholder,
      ...action,
      risk_assessment: decision.risk_assessment,
      confidence: decision.confidence,
      stadium_id: stadiumId,
      timestamp,
      // Auto-dispatch routine, queue critical for human
      status: action.priority >= 4 ? 'pending' : 'dispatched'
    });
  });

  await batch.commit();
  return { success: true, actions: Object.keys(decision.actions).length };
}
```

---

## Gemini Prompt Template (functions/nexusPrompt.js)

```javascript
export function buildNexusPrompt(stadium, crowdState, matchState) {
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

  return `
You are NEXUS, the AI operations engine for ${stadium.name}.
Stadium capacity: ${stadium.total_capacity}. Current attendance: ${matchState.attendance}.

ZONE STATE (real-time, updated 30s ago):
${JSON.stringify(zonesContext, null, 2)}

MATCH CONTEXT:
- Over: ${matchState.over}, Score: ${matchState.score}
- Halftime in: ${matchState.mins_to_halftime} minutes
- Weather: ${matchState.weather}
- Incentive budget remaining: ₹${matchState.remaining_budget}

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
```

---

## Crowd Simulator (functions/crowdSimulator.js)

```javascript
export async function simulateCrowd(stadiumId, db) {
  const matchDoc = await db.doc('match_events/current').get();
  const match = matchDoc.data();
  const t = match.match_minute; // -60 to 120

  function crowdAt(t, config) {
    const noise = (Math.random() - 0.5) * 0.03;
    if (t < config.arrivalPeak) {
      // Ramp up before kickoff
      const progress = Math.max(0, (t - (-60)) / (config.arrivalPeak - (-60)));
      return config.base + progress * config.preKickoffMax + noise;
    }
    if (t >= 0 && t <= 5) return config.base + config.preKickoffMax + noise;
    if (t > 44 && t < 48) return config.halftimePeak + noise; // halftime surge
    if (t >= 48 && t < 60) return config.halftimePeak - 0.08 + noise; // settle
    if (t >= 60 && t <= 65) return config.base + 0.2 + noise; // second half start
    if (t > 108) return config.postMatchPeak + noise; // exit surge
    return config.base + 0.2 + noise;
  }

  const zones = {
    north_stand:  crowdAt(t, { base:0.55, arrivalPeak:-15, preKickoffMax:0.32, halftimePeak:0.94, postMatchPeak:0.97 }),
    south_stand:  crowdAt(t, { base:0.48, arrivalPeak:-18, preKickoffMax:0.28, halftimePeak:0.88, postMatchPeak:0.95 }),
    east_block:   crowdAt(t, { base:0.40, arrivalPeak:-10, preKickoffMax:0.25, halftimePeak:0.72, postMatchPeak:0.90 }),
    west_block:   crowdAt(t, { base:0.38, arrivalPeak:-12, preKickoffMax:0.22, halftimePeak:0.68, postMatchPeak:0.88 }),
    concourse_a:  Math.min(0.99, (match.mins_to_halftime < 3 ? 0.91 : 0.45) + (Math.random()-0.5)*0.05)
  };

  const batch = db.batch();
  Object.entries(zones).forEach(([zoneId, pct]) => {
    batch.set(db.doc(`crowd_density/${zoneId}`), {
      pct: Math.min(0.99, Math.max(0.05, pct)),
      stadium_id: stadiumId,
      updated_at: new Date().toISOString()
    });
  });

  // Advance match clock
  await db.doc('match_events/current').update({
    match_minute: t + 0.5,
    mins_to_halftime: Math.max(0, match.mins_to_halftime - 0.5)
  });

  await batch.commit();
}
```

---

## Cloud Functions Entry Point (functions/index.js)

```javascript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';
import { simulateCrowd } from './crowdSimulator.js';
import { runNexusEngine } from './nexusEngine.js';

admin.initializeApp();
const db = admin.firestore();

// Crowd simulator — runs every 30 seconds
export const crowdSimulatorCron = onSchedule('every 1 minutes', async () => {
  await simulateCrowd('chepauk', db);
  // Run twice per minute (every 30s approximation)
  await new Promise(r => setTimeout(r, 30000));
  await simulateCrowd('chepauk', db);
});

// NEXUS engine — triggers when crowd density updates
export const nexusOnCrowdUpdate = onDocumentUpdated(
  'crowd_density/{zoneId}',
  async (event) => {
    const after = event.data.after.data();
    // Only trigger if zone crosses threshold
    if (after.pct >= 0.80) {
      await runNexusEngine(after.stadium_id);
    }
  }
);

// Manual trigger for demo controls
export const nexusTrigger = onRequest(async (req, res) => {
  const { stadiumId = 'chepauk', scenario } = req.body;

  if (scenario === 'halftime') {
    await db.doc('match_events/current').update({
      mins_to_halftime: 8,
      match_minute: 37
    });
    // Spike north stand
    await db.doc('crowd_density/north_stand').update({ pct: 0.91 });
  }

  await runNexusEngine(stadiumId);
  res.json({ success: true });
});
```

---

## Stadium Map Component (src/components/StadiumMap.jsx)

```jsx
import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const CHEPAUK_ZONES = [
  {
    id: 'north_stand',
    label: 'North Stand',
    coords: [
      { lat: 13.0641, lng: 80.2783 },
      { lat: 13.0644, lng: 80.2798 },
      { lat: 13.0638, lng: 80.2800 },
      { lat: 13.0635, lng: 80.2785 }
    ]
  },
  // Add south, east, west similarly
];

function densityToColor(pct) {
  if (pct >= 0.93) return '#A32D2D';
  if (pct >= 0.85) return '#E24B4A';
  if (pct >= 0.70) return '#EF9F27';
  return '#639922';
}

export default function StadiumMap({ crowdDensity, lastActions }) {
  const mapRef = useRef(null);
  const polygonsRef = useRef({});

  useEffect(() => {
    const loader = new Loader({
      apiKey: import.meta.env.VITE_MAPS_KEY,
      version: 'weekly'
    });

    loader.load().then(() => {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 13.0631, lng: 80.2790 },
        zoom: 17,
        mapTypeId: 'satellite',
        disableDefaultUI: true
      });

      CHEPAUK_ZONES.forEach(zone => {
        const polygon = new google.maps.Polygon({
          paths: zone.coords,
          fillColor: '#639922',
          fillOpacity: 0.5,
          strokeColor: '#ffffff',
          strokeWeight: 1,
          map
        });

        const infoWindow = new google.maps.InfoWindow();
        polygon.addListener('click', (e) => {
          const density = crowdDensity[zone.id];
          infoWindow.setContent(`
            <div style="font-family:sans-serif;padding:8px">
              <b>${zone.label}</b><br/>
              Density: ${Math.round((density?.pct ?? 0) * 100)}%<br/>
              <span style="color:gray;font-size:12px">
                ${lastActions[zone.id]?.action ?? 'No recent action'}
              </span>
            </div>
          `);
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        });

        polygonsRef.current[zone.id] = polygon;
      });
    });
  }, []);

  // Update polygon colors when crowd data changes
  useEffect(() => {
    Object.entries(crowdDensity).forEach(([zoneId, data]) => {
      const polygon = polygonsRef.current[zoneId];
      if (polygon) {
        polygon.setOptions({ fillColor: densityToColor(data.pct) });
      }
    });
  }, [crowdDensity]);

  return <div ref={mapRef} style={{ width: '100%', height: '300px', borderRadius: '8px' }} />;
}
```

---

## FCM Service Worker (public/firebase-messaging-sw.js)

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_KEY',
  projectId: 'nexus-stadium',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/nexus-icon.png',
    badge: '/nexus-badge.png',
    data: payload.data
  });
});
```

---

## Demo Controls Component (src/pages/DemoControls.jsx)

```jsx
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const scenarios = [
  {
    id: 'halftime',
    label: 'Simulate halftime surge',
    description: 'North Stand spikes to 91% over 45 seconds',
    color: '#E24B4A'
  },
  {
    id: 'gate_emergency',
    label: 'Gate 7 blocked',
    description: 'Security incident at main entry — force redirect',
    color: '#A32D2D'
  },
  {
    id: 'postmatch',
    label: 'Final whistle',
    description: 'All zones spike to exit surge levels',
    color: '#EF9F27'
  },
  {
    id: 'reset',
    label: 'Reset to pre-match',
    description: 'Match minute = -30, all zones at baseline',
    color: '#639922'
  }
];

export default function DemoControls() {
  async function triggerScenario(scenario) {
    await fetch('/api/nexusTrigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stadiumId: 'chepauk', scenario })
    });
  }

  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Demo control panel</h2>
      {scenarios.map(s => (
        <button
          key={s.id}
          onClick={() => triggerScenario(s.id)}
          style={{
            display: 'block', width: '100%', marginBottom: 10,
            padding: '10px 14px', border: `1px solid ${s.color}`,
            borderRadius: 8, background: 'transparent',
            cursor: 'pointer', textAlign: 'left'
          }}
        >
          <div style={{ fontWeight: 500, fontSize: 13 }}>{s.label}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.description}</div>
        </button>
      ))}
    </div>
  );
}
```

---

## Deployment Commands

```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# Local dev with emulators
firebase emulators:start

# View logs
firebase functions:log

# Seed initial data (run once)
node scripts/seedFirestore.js
```

---

## Firestore Security Rules (firestore.rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Anyone can read crowd data and actions (for fan app)
    match /crowd_density/{doc} {
      allow read: if true;
      allow write: if false; // only Cloud Functions write
    }

    match /nexus_actions/{doc} {
      allow read: if true;
      allow update: if request.auth != null; // operators can approve/reject
      allow create, delete: if false;
    }

    // Only authenticated operators can read full stadium config
    match /stadiums/{doc} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // Fans can read/write their own profile
    match /fan_profiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Only Cloud Functions write match events
    match /match_events/{doc} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## Common Debugging Checklist

**Gemini not responding:**
- Check GEMINI_API_KEY in Firebase Functions environment: `firebase functions:config:set gemini.key="YOUR_KEY"`
- Verify model name is exactly `gemini-2.0-flash`
- Check Cloud Functions logs: `firebase functions:log`

**Firestore not updating in real time:**
- Verify `onSnapshot` unsubscribe is returned from useEffect
- Check Firestore rules allow reads
- Check browser console for permission errors

**FCM notifications not appearing:**
- Service worker must be at `/public/firebase-messaging-sw.js`
- Request notification permission before registering token
- Test with FCM console first before coding

**Maps not loading:**
- Verify Maps JS API is enabled in GCP console
- Check API key restrictions (allow your domain)
- Ensure billing is enabled (required for Maps, use your GCP credits)

**Cloud Scheduler not firing:**
- Verify Cloud Scheduler API is enabled in GCP console
- Check job is in correct region
- View job execution history in GCP console

---

## AntiGravity Prompt Templates

Use these as starting points when building components:

**For any new component:**
> "Build a React component called [ComponentName] for the NEXUS stadium operations system. It connects to Firebase Firestore and subscribes to [collection]. It shows [describe UI]. Use CSS variables for theming (light/dark mode compatible). The component should feel like professional ops software — clean, data-dense, no decorative elements."

**For Cloud Functions:**
> "Write a Firebase Cloud Function (v2 API) called [functionName]. It [describe trigger]. It reads from Firestore collections [list]. It calls the Gemini 2.0 Flash API with [describe prompt]. It writes results to [collection]. Include error handling and return a result object."

**For debugging:**
> "I have a Firebase Cloud Function that [describe what it does]. When I run it, I get this error: [paste error]. The function code is: [paste code]. Fix it."
