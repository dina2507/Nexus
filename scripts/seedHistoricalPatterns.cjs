/**
 * NEXUS — Seed historical_patterns/{stadiumId}
 * One-shot script that writes a few prior-match summaries Gemini can ground on.
 *
 * Usage:
 *   node scripts/seedHistoricalPatterns.cjs
 *
 * Reads VITE_FIREBASE_API_KEY from .env and writes via the Firestore REST API
 * (matches the convention used by scripts/seedFirestore.cjs).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'prompt-wars-492706';
const STADIUM_ID = 'chepauk';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const API_KEY = envContent.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();

if (!API_KEY) {
  console.error('Could not read VITE_FIREBASE_API_KEY from .env');
  process.exit(1);
}

const HISTORICAL_PATTERNS = {
  stadium_id: STADIUM_ID,
  updated_at: new Date().toISOString(),
  patterns: [
    {
      label: 'CSK vs RCB · 2025-04-12',
      description: 'North Stand hit 96% within 4 min of halftime. Concourse A bottleneck triggered medical incident at minute 47.',
      outcome: 'Without coordination: 1 fall, 14 min recovery. With NEXUS-style nudges (simulated): peak capped at 84%.',
    },
    {
      label: 'CSK vs MI · 2025-05-02',
      description: 'Final whistle exit surge — all four stands above 90% within 3 min. Bus dispatch was misaligned by 8 min.',
      outcome: 'Avg gate-to-bus time: 38 min. Coordinated hold of 5 buses for 20 min would have cut this to ~22 min.',
    },
    {
      label: 'CSK vs KKR · 2025-05-18',
      description: 'Rain delay at minute 28 caused a sustained concourse rush. East Block concession queues reached 18 min.',
      outcome: 'Pre-positioning concession prep (+200 units) at minute 22 would have prevented the queue overflow.',
    },
  ],
};

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function buildDocBody(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  return JSON.stringify({ fields });
}

function patchDoc(docPath, data) {
  return new Promise((resolve, reject) => {
    const body = buildDocBody(data);
    const url = new URL(`${BASE_URL}/${docPath}?key=${API_KEY}`);
    const req = https.request(
      {
        method: 'PATCH',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => { chunks += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(chunks);
          else reject(new Error(`HTTP ${res.statusCode}: ${chunks}`));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    await patchDoc(`historical_patterns/${STADIUM_ID}`, HISTORICAL_PATTERNS);
    console.log(`Seeded historical_patterns/${STADIUM_ID} with ${HISTORICAL_PATTERNS.patterns.length} patterns`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
