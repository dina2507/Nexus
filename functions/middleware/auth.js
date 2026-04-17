const admin = require('firebase-admin');

async function requireOperator(req, res, next) {
  // CORS preflight requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    // Attach uid to req
    req.uid = uid;

    // Optional: we can pass db explicitly, or just use admin.firestore()
    const db = admin.firestore();
    const operatorSnap = await db.doc(`operators/${uid}`).get();
    
    if (!operatorSnap.exists) {
      console.warn(`Auth reject: UID ${uid} not in operators collection`);
      return res.status(403).json({ error: 'Forbidden: User is not an operator' });
    }

    const role = operatorSnap.data().role;
    req.operatorRole = role;

    if (role !== 'admin' && role !== 'viewer') {
      console.warn(`Auth reject: UID ${uid} has invalid role: ${role}`);
      return res.status(403).json({ error: 'Forbidden: Invalid role' });
    }

    // Check destructive actions
    const { scenario, manualAction, emergencyBroadcast, confirmCode } = req.body;
    const isDestructive = manualAction || emergencyBroadcast || 
                          scenario === 'gate_emergency' || scenario === 'postmatch';
    
    if (isDestructive && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin role required for this action' });
    }

    if (emergencyBroadcast && confirmCode !== 'EMERGENCY') {
      return res.status(400).json({ error: 'Bad Request: Emergency broadcast requires confirmCode: "EMERGENCY"' });
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

module.exports = { requireOperator };
