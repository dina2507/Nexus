const admin = require('firebase-admin');

async function simulateCrowd(stadiumId, db) {
  const matchRef = db.collection('match_events').doc('current');
  const matchDoc = await matchRef.get();
  let matchMinute = matchDoc.exists ? matchDoc.data().match_minute : -60;
  let minsToHalftime = matchDoc.exists ? matchDoc.data().mins_to_halftime : 105;

  // Add random noise
  const addNoise = (base) => base + (Math.random() * 0.06 - 0.03);
  const clamp = (val) => Math.max(0.05, Math.min(0.99, val));

  // Determine values based on time
  const getNorth = (m) => {
    if (m >= 110) return 0.97;
    if (m >= 45 && m <= 60) return 0.94;
    if (m >= 0) return 0.87;
    return 0.55 + ((0.87 - 0.55) * (Math.max(0, m + 60) / 60)); // ramp
  };

  const getSouth = (m) => {
    if (m >= 110) return 0.95;
    if (m >= 45 && m <= 60) return 0.88;
    if (m >= 0) return 0.82;
    return 0.48 + ((0.82 - 0.48) * (Math.max(0, m + 60) / 60));
  };

  const getEast = (m) => {
    if (m >= 110) return 0.90;
    if (m >= 45 && m <= 60) return 0.72;
    if (m >= 0) return 0.72;
    return 0.40 + ((0.72 - 0.40) * (Math.max(0, m + 60) / 60));
  };

  const getWest = (m) => {
    if (m >= 110) return 0.88;
    if (m >= 45 && m <= 60) return 0.68;
    if (m >= 0) return 0.68;
    return 0.38 + ((0.68 - 0.38) * (Math.max(0, m + 60) / 60));
  };

  const getConcourse = (m, minsToHalf) => {
    if (minsToHalf < 3 && minsToHalf > 0) return 0.91;
    return 0.45;
  };
  
  const zones = {
    'north_stand': clamp(addNoise(getNorth(matchMinute))),
    'south_stand': clamp(addNoise(getSouth(matchMinute))),
    'east_block': clamp(addNoise(getEast(matchMinute))),
    'west_block': clamp(addNoise(getWest(matchMinute))),
    'concourse_a': clamp(addNoise(getConcourse(matchMinute, minsToHalftime))),
  };

  const batch = db.batch();
  for (const [zoneId, pct] of Object.entries(zones)) {
    const zoneRef = db.collection('crowd_density').doc(zoneId);
    batch.set(zoneRef, {
      pct: pct,
      stadium_id: stadiumId,
      updated_at: new Date().toISOString()
    });
  }
  
  await batch.commit();

  await matchRef.update({
    match_minute: matchMinute + 0.5,
    mins_to_halftime: Math.max(0, minsToHalftime - 0.5)
  });
}

module.exports = { simulateCrowd };
