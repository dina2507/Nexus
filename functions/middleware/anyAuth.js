const admin = require('firebase-admin');

// Verifies the Firebase ID token is valid — does not require operator role.
// Used for fan-facing endpoints where any authenticated user (including anonymous) is allowed.
async function requireAnyAuth(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.uid = decodedToken.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

module.exports = { requireAnyAuth };
