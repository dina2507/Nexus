const { runNexusEngine } = require('../nexusEngine');

// Mock @google/generative-ai
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => JSON.stringify({
          risk_assessment: "Test risk",
          confidence: 0.9,
          actions: { fans: { action: "Test", target_zone: "z1", incentive_inr: 50, priority: 3 } }
        })}
      })
    })
  }))
}));

describe('runNexusEngine', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      doc: jest.fn(),
      collection: jest.fn(),
      runTransaction: jest.fn(async (cb) => {
        const t = { get: jest.fn().mockResolvedValue({ data: () => ({ last_call: null }) }), set: jest.fn() };
        return await cb(t);
      }),
      batch: jest.fn(() => ({ set: jest.fn(), commit: jest.fn() }))
    };
  });

  it('returns skipped: true when nexus_state/engine.paused === true', async () => {
    mockDb.doc.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ paused: true }) })
    });

    const result = await runNexusEngine('chepauk', mockDb);
    expect(result).toEqual({ skipped: true, reason: 'Paused' });
  });

  it('returns skipped: true when throttled', async () => {
    mockDb.doc.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ paused: false }) })
    });
    mockDb.runTransaction = jest.fn(async (cb) => {
      const t = { get: jest.fn().mockResolvedValue({ data: () => ({ last_call: new Date().toISOString() }) }), set: jest.fn() };
      return await cb(t); // returns false because difference is 0
    });

    const result = await runNexusEngine('chepauk', mockDb);
    expect(result).toEqual({ skipped: true, reason: 'Throttled' });
  });

  it('ignores throttle when force is true', async () => {
    // We will bypass the runTransaction if force is true and go down checking other docs.
    // If it fails with "No stadium config", it means it bypassed the throttle check.
    mockDb.doc.mockReturnValue({
      get: jest.fn().mockResolvedValue({ exists: false, data: () => null })
    });
    mockDb.collection.mockReturnValue({
      where: () => ({ get: jest.fn().mockResolvedValue([]) })
    });

    const result = await runNexusEngine('chepauk', mockDb, { force: true });
    expect(result).toEqual({ skipped: true, reason: 'No stadium config' });
  });
});
