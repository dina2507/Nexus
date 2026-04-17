const { mintJwt, verifyJwt } = require('../voucher');

describe('Voucher System (JWT)', () => {
  const secret = 'test_secret_key_123';
  const payload = {
    uid: 'user_123',
    action_id: 'action_456',
    inr: 80,
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  test('should mint a valid JWT', () => {
    const token = mintJwt(payload, secret);
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
  });

  test('should verify a valid token and return payload', () => {
    const token = mintJwt(payload, secret);
    const decoded = verifyJwt(token, secret);
    expect(decoded.uid).toBe(payload.uid);
    expect(decoded.inr).toBe(payload.inr);
  });

  test('should throw error for invalid signature', () => {
    const token = mintJwt(payload, secret);
    expect(() => verifyJwt(token, 'wrong_secret')).toThrow('Invalid signature');
  });

  test('should throw error for tampered payload', () => {
    const token = mintJwt(payload, secret);
    const parts = token.split('.');
    // Tamper with the body (middle part)
    const tamperedBody = Buffer.from(JSON.stringify({ ...payload, inr: 1000 })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedBody}.${parts[2]}`;
    expect(() => verifyJwt(tamperedToken, secret)).toThrow('Invalid signature');
  });
});
