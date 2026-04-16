const { buildNexusPrompt } = require('../nexusPrompt');

describe('buildNexusPrompt', () => {
  const stadium = {
    name: 'Test Stadium',
    total_capacity: 10000,
    crush_threshold: 0.8,
    critical_threshold: 0.9,
    zones: [
      { id: 'zone1', label: 'Zone 1', capacity: 1000 }
    ]
  };
  const crowdState = { zone1: { pct: 0.5 } };
  const matchState = { attendance: 5000, over: 10, score: '100/2', mins_to_halftime: 10, weather: 'Clear', remaining_budget: 10000 };

  it('omits HISTORICAL PATTERNS when not provided', () => {
    const prompt = buildNexusPrompt(stadium, crowdState, matchState, null);
    expect(prompt).not.toContain('HISTORICAL PATTERNS');
  });

  it('includes HISTORICAL PATTERNS when provided with 3 entries', () => {
    const historicalPatterns = {
      patterns: [
        { label: 'Pattern 1', description: 'desc 1', outcome: 'out 1' },
        { label: 'Pattern 2', description: 'desc 2', outcome: 'out 2' },
        { label: 'Pattern 3', description: 'desc 3', outcome: 'out 3' }
      ]
    };
    const prompt = buildNexusPrompt(stadium, crowdState, matchState, historicalPatterns);
    expect(prompt).toContain('HISTORICAL PATTERNS');
    expect(prompt).toContain('Pattern 1');
    expect(prompt).toContain('Pattern 2');
    expect(prompt).toContain('Pattern 3');
  });

  it('computes zone capacity counts correctly', () => {
    const prompt = buildNexusPrompt(stadium, crowdState, matchState, null);
    expect(prompt).toContain('"current_count": 500'); // 0.5 * 1000
    expect(prompt).toContain('"crush_threshold_count": 800'); // 0.8 * 1000
  });
});
