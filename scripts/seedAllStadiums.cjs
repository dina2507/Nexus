const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Ensure you have set GOOGLE_APPLICATION_CREDENTIALS or just run via standard methods
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'prompt-wars-492706';
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function seed() {
  console.log('Seeding stadiums...');
  
  // Create wankhede based on chepauk style
  const wankhede = {
    id: 'wankhede',
    name: 'Wankhede Stadium, Mumbai',
    total_capacity: 33000,
    coords: { lat: 18.9388, lng: 72.8258 },
    crush_threshold: 0.85,
    critical_threshold: 0.94,
    zones: [
      { id: 'north_stand', name: 'MCA Pavilion', capacity: 6000, gates: ['G1', 'G2'], adjacent_zones: ['concourse_a'] },
      { id: 'south_stand', name: 'Garware Pavilion', capacity: 7000, gates: ['G3', 'G4'], adjacent_zones: ['concourse_a'] },
      { id: 'east_block', name: 'Sunil Gavaskar Stand', capacity: 10000, gates: ['G5'], adjacent_zones: ['concourse_b'] },
      { id: 'west_block', name: 'Vithal Divecha Stand', capacity: 6000, gates: ['G6'], adjacent_zones: ['concourse_b'] },
      { id: 'concourse_a', name: 'Main Concourse', capacity: 2000, gates: [], adjacent_zones: ['north_stand', 'south_stand'] },
      { id: 'concourse_b', name: 'Outer Concourse', capacity: 2000, gates: [], adjacent_zones: ['east_block', 'west_block'] }
    ],
    incentive_config: {
      min_value_inr: 60,
      standard_value_inr: 120,
      max_budget_per_match_inr: 300000,
      acceptance_rate_at_100: 0.70
    }
  };

  await db.doc('stadiums/wankhede').set(wankhede);

  // Load existing Chepauk
  try {
    const chepaukJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/chepauk.json'), 'utf8'));
    await db.doc('stadiums/chepauk').set(chepaukJson);
  } catch(e) {
    console.error('Chepauk load failed:', e);
  }

  console.log('Stadiums seeded successfully.');
}

seed().catch(console.error).finally(() => process.exit(0));
