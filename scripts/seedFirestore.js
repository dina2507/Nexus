import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ID = 'prompt-wars-492706';
const _FIREBASE_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const FIREBASE_TOOLS_CONFIG = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json'
);

const SEED_DOCS = {
  stadiums: {
    chepauk: () => {
      const chepaukPath = path.join(__dirname, '..', 'src', 'data', 'chepauk.json');
      return JSON.parse(fs.readFileSync(chepaukPath, 'utf8'));
    }
  },
  match_events: {
    current: {
      match_minute: -30,
      mins_to_halftime: 45,
      score: '0/0',
      over: 0,
      attendance: 38000,
      weather: 'Clear, 28°C',
      remaining_budget: 200000
    }
  },
  crowd_density: {
    north_stand: { pct: 0.55, stadium_id: 'chepauk' },
    south_stand: { pct: 0.48, stadium_id: 'chepauk' },
    east_block: { pct: 0.4, stadium_id: 'chepauk' },
    west_block: { pct: 0.38, stadium_id: 'chepauk' },
    concourse_a: { pct: 0.41, stadium_id: 'chepauk' }
  }
};

// Initialize Firebase Admin
initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID
});

const db = getFirestore();

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
    for (const [key, value] of Object.entries(val)) {
      fields[key] = toFirestoreValue(value);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function buildDocBody(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return { fields };
}

function getFirebaseCliAccessToken() {
  const raw = fs.readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8');
  const parsed = JSON.parse(raw);
  const refreshToken = parsed?.tokens?.refresh_token;
  const clientId = parsed?.user?.azp;

  if (!refreshToken || !clientId) {
    const token = parsed?.tokens?.access_token;
    if (!token) {
      throw new Error('No Firebase CLI credentials found in firebase-tools.json');
    }
    return token;
  }

  const client = new OAuth2Client(clientId, FIREBASE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  return client.getAccessToken().then(({ token }) => {
    if (!token) {
      throw new Error('Could not refresh a Google OAuth access token from Firebase CLI credentials');
    }
    return token;
  });
}

async function writeDocWithRest(collection, docId, data, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(buildDocBody(data))
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to write ${collection}/${docId}: ${resp.status} ${err}`);
  }
}

async function seedWithAdmin() {
  console.log('🚀 Starting Firestore seeding with firebase-admin...');

  for (const [docId, dataFactory] of Object.entries(SEED_DOCS.stadiums)) {
    await db.collection('stadiums').doc(docId).set(dataFactory());
    console.log('Seeding complete for stadiums/chepauk');
  }

  for (const [docId, data] of Object.entries(SEED_DOCS.match_events)) {
    await db.collection('match_events').doc(docId).set(data);
    console.log('Seeding complete for match_events/current');
  }

  for (const [docId, data] of Object.entries(SEED_DOCS.crowd_density)) {
    await db.collection('crowd_density').doc(docId).set({
      ...data,
      updated_at: new Date().toISOString()
    });
    console.log(`Seeding complete for crowd_density/${docId}`);
  }
}

async function seedWithRest() {
  console.log('🚀 Starting Firestore seeding with Firebase CLI credentials...');
  const accessToken = await getFirebaseCliAccessToken();

  for (const [docId, dataFactory] of Object.entries(SEED_DOCS.stadiums)) {
    await writeDocWithRest('stadiums', docId, dataFactory(), accessToken);
    console.log('Seeding complete for stadiums/chepauk');
  }

  for (const [docId, data] of Object.entries(SEED_DOCS.match_events)) {
    await writeDocWithRest('match_events', docId, data, accessToken);
    console.log('Seeding complete for match_events/current');
  }

  for (const [docId, data] of Object.entries(SEED_DOCS.crowd_density)) {
    await writeDocWithRest(
      'crowd_density',
      docId,
      {
        ...data,
        updated_at: new Date().toISOString()
      },
      accessToken
    );
    console.log(`Seeding complete for crowd_density/${docId}`);
  }
}

async function seed() {
  try {
    await seedWithAdmin();
    console.log('🎉 All seeding operations finished successfully!');
  } catch (error) {
    if (
      String(error?.message || error).includes('Could not load the default credentials') ||
      String(error?.message || error).includes('default credentials')
    ) {
      try {
        await seedWithRest();
        console.log('🎉 All seeding operations finished successfully!');
        return;
      } catch (restError) {
        console.error('❌ Error during seeding:', restError);
        process.exit(1);
      }
    }

    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

seed();
