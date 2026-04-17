const { buildFallbackDecision } = require('../nexusEngine');

describe('NEXUS Decision Engine - Fallback Logic', () => {
  const stadium = {
    crush_threshold: 0.82,
    critical_threshold: 0.93
  };

  const matchState = {
    match_minute: 45,
    mins_to_halftime: 0
  };

  test('should trigger critical priority when density is > 93%', () => {
    const crowdState = {
      north_stand: { pct: 0.95, stadium_id: 'chepauk' },
      south_stand: { pct: 0.40, stadium_id: 'chepauk' }
    };

    const decision = buildFallbackDecision(crowdState, matchState, stadium);
    expect(decision.confidence).toBe(0.65);
    expect(decision.actions.security.priority).toBe(4);
    expect(decision.actions.fans.priority).toBe(4);
    expect(decision.risk_assessment).toContain('taking autonomous action');
  });

  test('should trigger moderate priority when density is between 82% and 93%', () => {
    const crowdState = {
      north_stand: { pct: 0.85, stadium_id: 'chepauk' },
      south_stand: { pct: 0.40, stadium_id: 'chepauk' }
    };

    const decision = buildFallbackDecision(crowdState, matchState, stadium);
    expect(decision.actions.security.priority).toBe(3);
    expect(decision.risk_assessment).toContain('Approaching crush threshold');
  });

  test('should correctly identify the hottest zone', () => {
    const crowdState = {
      north_stand: { pct: 0.50 },
      south_stand: { pct: 0.88 },
      east_block: { pct: 0.60 }
    };

    const decision = buildFallbackDecision(crowdState, matchState, stadium);
    expect(decision.actions.security.target).toBe('south_stand');
  });
});
