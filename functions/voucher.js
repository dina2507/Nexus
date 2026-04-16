const crypto = require('crypto');

function mintJwt(payload, secret) {
  if (!secret) throw new Error('JWT secret is required');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token, secret) {
  if (!secret) throw new Error('JWT secret is required');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token structure');
  
  const [header, body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  }
  throw new Error('Invalid signature');
}

module.exports = { mintJwt, verifyJwt };
