async function simulateTicketScans(stadiumId, db) {
  const matchDoc = await db.doc('match_events/current').get();
  const matchMinute = matchDoc.data()?.match_minute || -30;
  
  // Weights based on match minute
  let scanVolume = 5; // Default low
  if (matchMinute < 0) scanVolume = 80; // Pre-match surge
  else if (matchMinute > 40 && matchMinute < 50) scanVolume = 100; // Halftime surge
  else if (matchMinute > 100) scanVolume = 0; // Post-match

  const gates = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];
  const batch = db.batch();
  const now = new Date();
  
  const gateCounts = {};
  gates.forEach(g => gateCounts[g] = 0);

  // Generate random scans
  const numScans = Math.max(0, scanVolume + Math.round((Math.random() - 0.5) * 20));
  for (let i = 0; i < numScans; i++) {
    const gate = gates[Math.floor(Math.random() * gates.length)];
    gateCounts[gate]++;
    
    const ref = db.collection('ticket_scans').doc();
    batch.set(ref, {
      stadium_id: stadiumId,
      gate,
      timestamp: now.toISOString(),
      seat_id: `SEC-${Math.floor(Math.random()*100)}-${Math.floor(Math.random()*500)}`
    });
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
  console.log(`Ticket scan simulator generated ${numScans} scans across ${gates.length} gates.`);
}

module.exports = { simulateTicketScans };
