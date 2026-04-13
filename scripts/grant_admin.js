import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECT_ID = 'prompt-wars-492706';
const FIREBASE_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const FIREBASE_TOOLS_CONFIG = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json'
);

const USER_UID = 'ub5HZNccFpWoXjeHe8Cxz0jDbkc2';
const USER_EMAIL = 'dina.iic25@gmail.com';

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

async function getFirebaseCliAccessToken() {
  if (!fs.existsSync(FIREBASE_TOOLS_CONFIG)) {
    throw new Error('Firebase CLI config not found. Please run: firebase login');
  }
  const raw = fs.readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8');
  const parsed = JSON.parse(raw);
  const refreshToken = parsed?.tokens?.refresh_token;
  const clientId = parsed?.user?.azp;

  if (!refreshToken || !clientId) {
    const token = parsed?.tokens?.access_token;
    if (!token) {
      throw new Error('No Firebase CLI credentials found. Please run: firebase login');
    }
    return token;
  }

  const client = new OAuth2Client(clientId, FIREBASE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error('Could not refresh access token');
  }
  return token;
}

async function writeDocWithRest(uid, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/operators/${uid}`;
  const data = {
    email: USER_EMAIL,
    role: 'admin',
    granted_at: new Date().toISOString()
  };
  
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
    throw new Error(`REST Error: ${resp.status} ${err}`);
  }
}

async function grantAccess() {
  console.log(`🚀 Granting admin access to ${USER_EMAIL} (${USER_UID})...`);
  
  try {
    // Try Admin SDK first
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID
    });
    const db = getFirestore();
    await db.collection('operators').doc(USER_UID).set({
      email: USER_EMAIL,
      role: 'admin',
      granted_at: new Date().toISOString()
    });
    console.log('✅ Access granted via Admin SDK!');
  } catch (error) {
    if (error.message.includes('Could not load the default credentials')) {
      console.log('⚠️ Admin SDK credentials not found, falling back to REST API...');
      try {
        const token = await getFirebaseCliAccessToken();
        await writeDocWithRest(USER_UID, token);
        console.log('✅ Access granted via REST API!');
      } catch (restError) {
        console.error('❌ Error granting access:', restError.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Error granting access:', error.message);
      process.exit(1);
    }
  }
}

grantAccess();
