const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll check if this exists or use default

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function triggerHalftime() {
  console.log('Triggering Halftime Surge scenario...');
  
  const batch = db.batch();
  
  // 1. Spike the North Stand
  batch.update(db.doc('crowd_density/north_stand'), { 
    pct: 0.91,
    updated_at: new Date().toISOString()
  });
  
  // 2. Set match state to halftime approach
  batch.update(db.doc('match_events/current'), {
    mins_to_halftime: 8,
    match_minute: 37
  });

  await batch.commit();
  console.log('Firestore updated. AI cascade should trigger now.');
}

triggerHalftime().catch(console.error);
