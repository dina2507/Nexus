/**
 * NEXUS — One-time Firestore seeder
 * Seeds stadiums, match_events, and crowd_density collections.
 * Uses Firestore REST API with the existing Firebase API key.
 * 
 * Usage: node scripts/seedFirestore.cjs
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'prompt-wars-492706';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Read API key from .env
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const API_KEY = envContent.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();

if (!API_KEY) {
  console.error('❌ Could not read VITE_FIREBASE_API_KEY from .env');
  process.exit(1);
}

/**
 * Convert a JS value to Firestore REST API value format
 */
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
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Build Firestore document body from a plain JS object
 */
function buildDocBody(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

/**
 * Write a document to Firestore via REST API
 */
async function writeDoc(collection, docId, data) {
  const url = `${BASE_URL}/${collection}/${docId}?key=${API_KEY}`;
  const body = buildDocBody(data);

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to write ${collection}/${docId}: ${resp.status} ${err}`);
  }

  return true;
}

async function seed() {
  console.log('🏟️  NEXUS Firestore Seeder — Starting...\n');

  // 1. Seed stadiums/chepauk
  const chepaukPath = path.join(__dirname, '..', 'src', 'data', 'chepauk.json');
  const chepaukData = JSON.parse(fs.readFileSync(chepaukPath, 'utf8'));
  await writeDoc('stadiums', 'chepauk', chepaukData);
  console.log('✅ Seeded: stadiums/chepauk');

  // 2. Seed match_events/current
  await writeDoc('match_events', 'current', {
    match_minute: -30,
    mins_to_halftime: 45,
    score: '0/0',
    over: 0,
    attendance: 38000,
    weather: 'Clear, 28°C',
    remaining_budget: 200000
  });
  console.log('✅ Seeded: match_events/current');

  // 3. Seed crowd_density — 5 zone documents
  const zones = {
    north_stand: 0.55,
    south_stand: 0.48,
    east_block: 0.40,
    west_block: 0.38,
    concourse_a: 0.41
  };

  for (const [zoneId, pct] of Object.entries(zones)) {
    await writeDoc('crowd_density', zoneId, {
      pct,
      stadium_id: 'chepauk',
      updated_at: new Date().toISOString()
    });
    console.log(`✅ Seeded: crowd_density/${zoneId} (${(pct * 100).toFixed(0)}%)`);
  }

  console.log('\n🎉 Seeding complete — 7 documents written to Firestore.');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
