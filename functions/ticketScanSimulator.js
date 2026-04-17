async function simulateTicketScans(stadiumId, db) {
  const matchDoc = await db.doc('match_events/current').get();
  const matchData = matchDoc.data();
  const matchMinute = matchData?.match_minute || -30;
  const minsToHalftime = matchData?.mins_to_halftime || 45;
  
  // Weights based on match phase
  let baseVolume = 5; 
  if (matchMinute < 0) {
    // Pre-match entry surge (higher as we get closer to 0)
    const factor = Math.max(0, 1 - Math.abs(matchMinute) / 30);
    baseVolume = 20 + factor * 100;
  } else if (minsToHalftime > 0 && minsToHalftime <= 10) {
    // Approaching halftime surge (fans going to concourse)
    const factor = (10 - minsToHalftime) / 10;
    baseVolume = 10 + factor * 60;
  } else if (matchMinute > 90) {
    // Post-match (exit scans - if we had exit gates, but here we scan entry/concourse)
    baseVolume = 2;
  }

  // Random burst factor (e.g., a bus arrival)
  const isBurst = Math.random() > 0.92;
  const burstVolume = isBurst ? Math.floor(Math.random() * 150) : 0;

  const gates = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
  const batch = db.batch();
  const now = new Date();
  
  const gateCounts = {};
  gates.forEach(g => gateCounts[g] = 0);

  // Generate random scans
  const numScans = Math.max(0, Math.floor(baseVolume + burstVolume + (Math.random() - 0.5) * 20));
  
  if (numScans > 0) {
    for (let i = 0; i < numScans; i++) {
      // Skew towards G1 and G7 (main gates)
      let gate;
      const rand = Math.random();
      if (rand < 0.25) gate = 'G1';
      else if (rand < 0.5) gate = 'G7';
      else gate = gates[Math.floor(Math.random() * gates.length)];
      
      gateCounts[gate]++;
      
      // Only write every 10th individual scan to Firestore to save on writes in demo
      if (i % 10 === 0) {
        const ref = db.collection('ticket_scans').doc();
        batch.set(ref, {
          stadium_id: stadiumId,
          gate,
          timestamp: now.toISOString(),
          seat_id: `SEC-${Math.floor(Math.random()*100)}-${Math.floor(Math.random()*500)}`
        });
      }
    }
  }
  
  // Aggregate into gates/{gateId}
  for (const gate of gates) {
    const gateRef = db.doc(`gates/${gate}`);
    batch.set(gateRef, {
      stadium_id: stadiumId,
      scan_rate_per_min: gateCounts[gate],
      updated_at: now.toISOString()
    }, { merge: true });
  }

  await batch.commit();
  console.log(`Ticket scan simulator: Generated ${numScans} scans (${isBurst ? 'BURST!' : 'Normal'}).`);
}

module.exports = { simulateTicketScans };
