const { buildFallbackDecision } = require('../nexusEngine');

describe('buildFallbackDecision', () => {
  it('identifies the hottest zone and includes it in all actions', () => {
    const crowdState = {
      north_stand: { pct: 0.95 },
      south_stand: { pct: 0.80 },
    };
    const matchState = { mins_to_halftime: 5 };
    const stadium = { critical_threshold: 0.93 };

    const decision = buildFallbackDecision(crowdState, matchState, stadium);

    expect(decision.actions.security.target).toBe('north_stand');
    expect(decision.actions.fans.target_zone).toBe('north_stand');
    expect(decision.actions.concessions.target_stand).toBe('north_stand');
    expect(decision.actions.medical.target_position).toContain('north_stand');
    
    // priority should be 4 since 0.95 >= critical
    expect(decision.actions.security.priority).toBe(4);
  });
});
