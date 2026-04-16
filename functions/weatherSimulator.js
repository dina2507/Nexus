async function simulateWeather(stadiumId, db) {
  const matchDoc = await db.doc('match_events/current').get();
  const matchMinute = matchDoc.data()?.match_minute || 0;

  // Sine wave based on match minute to simulate changes
  const period = 120; // Full match duration ish
  const phase = (matchMinute / period) * Math.PI;

  const temp_c = 28 + Math.round(Math.sin(phase) * 5); // 28 to 33
  const humidity = 65 + Math.round(Math.cos(phase) * 20); // 45 to 85
  const wind_kmh = 10 + Math.round(Math.sin(phase * 2) * 15); // 10 to 25
  const precip_mm = (humidity > 80 && temp_c < 30) ? Math.round(Math.random() * 8) : 0;
  
  let condition = 'clear';
  if (precip_mm > 0) condition = 'rain';
  else if (humidity > 75) condition = 'cloudy';

  await db.doc(`weather/${stadiumId}`).set({
    temp_c,
    humidity,
    wind_kmh,
    precip_mm,
    condition,
    updated_at: new Date().toISOString()
  }, { merge: true });

  console.log(`Weather simulator ran for ${stadiumId}: ${condition}, ${temp_c}°C`);
}

module.exports = { simulateWeather };
