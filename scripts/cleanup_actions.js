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
    if (!token) return null;
    return token;
  }

  const client = new OAuth2Client(clientId, FIREBASE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  return token;
}

async function cleanupSpamActions() {
  console.log('🚀 Starting cleanup of nexus_actions...');
  
  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID
    });
    const db = getFirestore();
    
    let deletedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const snapshot = await db.collection('nexus_actions')
        .limit(500)
        .get();
        
      if (snapshot.size === 0) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      await batch.commit();
      console.log(`Deleted ${deletedCount} actions so far...`);
    }
    console.log(`✅ Cleanup complete. Deleted ${deletedCount} spam actions.`);
  } catch (err) {
    if (err.message.includes('Could not load the default credentials')) {
      console.log('⚠️ Admin SDK credentials not found, falling back to REST...');
      const token = await getFirebaseCliAccessToken();
      
      let deletedCount = 0;
      let hasMore = true;

      while (hasMore) {
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
        const queryBody = {
          structuredQuery: {
            from: [{ collectionId: 'nexus_actions' }],
            limit: 300,
            select: { fields: [{ fieldPath: '__name__' }] }
          }
        };

        const qResp = await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(queryBody)
        });
        
        const qData = await qResp.json();
        const docs = qData.filter(d => d.document).map(d => d.document.name);

        if (docs.length === 0) {
          hasMore = false;
          break;
        }

        const batchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
        const writes = docs.map(name => ({ delete: name }));
        
        const bResp = await fetch(batchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ writes })
        });

        if (!bResp.ok) throw new Error('Batch delete failed');
        
        deletedCount += docs.length;
        console.log(`Deleted ${deletedCount} actions so far (via REST)...`);
      }
      console.log(`✅ Cleanup complete. Deleted ${deletedCount} spam actions.`);
    } else {
      console.error(err);
    }
  }
}

cleanupSpamActions();
