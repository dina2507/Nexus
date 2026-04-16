const { requireOperator } = require('../middleware/auth');

// Variables referenced in jest.mock factories MUST be prefixed with "mock"
const mockVerifyIdToken = jest.fn();
const mockGetDoc = jest.fn();

jest.mock('firebase-admin', () => ({
  auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  firestore: () => ({
    doc: () => ({ get: mockGetDoc })
  }),
}));

describe('nexusTrigger integration (requireOperator)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    mockVerifyIdToken.mockReset();
    mockGetDoc.mockReset();
  });

  it('emergencyBroadcast with no auth -> 401', async () => {
    req.body = { emergencyBroadcast: true };
    await requireOperator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('emergencyBroadcast with admin auth -> allows next() if confirmCode present', async () => {
    req.headers.authorization = 'Bearer good-token';
    req.body = { emergencyBroadcast: true, confirmCode: 'EMERGENCY' };

    mockVerifyIdToken.mockResolvedValue({ uid: 'admin-123' });
    mockGetDoc.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'admin' })
    });

    await requireOperator(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('manualAction with viewer auth -> 403', async () => {
    req.headers.authorization = 'Bearer good-token';
    req.body = { manualAction: { stakeholder: 'fans' } };

    mockVerifyIdToken.mockResolvedValue({ uid: 'viewer-123' });
    mockGetDoc.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'viewer' })
    });

    await requireOperator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
