import { Activity, Bell, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const densityColor = (pct) => {
  if (pct >= 0.93) return 'var(--danger)';
  if (pct >= 0.82) return '#ef4444';
  if (pct >= 0.70) return 'var(--warning)';
  return 'var(--success)';
};

const densityLabel = (pct) => {
  if (pct >= 0.93) return 'Critical';
  if (pct >= 0.82) return 'High';
  if (pct >= 0.70) return 'Moderate';
  return 'Normal';
};

export default function FanLiveTab({ matchState, actions, fanProfile, myZoneDensity = 0 }) {
  const handleHaptic = () => {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const relevantActions = actions
    .filter(a => a.stakeholder === 'fans' && (!a.target_zone || a.target_zone === fanProfile?.zone_id))
    .slice(0, 5);

  const zoneLabel = fanProfile?.section || (fanProfile?.zone_id?.replace(/_/g, ' ') || 'Your Zone');
  const pctDisplay = Math.round(myZoneDensity * 100);

  const TrendIcon = myZoneDensity >= 0.82 ? TrendingUp : myZoneDensity <= 0.40 ? TrendingDown : Minus;
  const trendColor = densityColor(myZoneDensity);

  const remaining = matchState?.remaining_budget ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Zone density card */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Users size={16} style={{ color: densityColor(myZoneDensity) }} />
          <span className="section-label">Your Zone — Live</span>
          <span style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
            color: densityColor(myZoneDensity), textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {densityLabel(myZoneDensity)}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{zoneLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            flex: 1, height: '8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${pctDisplay}%`, height: '100%',
              background: densityColor(myZoneDensity),
              borderRadius: '4px',
              transition: 'width 0.6s ease, background 0.4s ease',
            }} />
          </div>
          <TrendIcon size={14} style={{ color: trendColor, flexShrink: 0 }} />
          <span style={{ fontSize: '18px', fontWeight: 700, color: densityColor(myZoneDensity),
            minWidth: '42px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {pctDisplay}%
          </span>
        </div>
      </div>

      {/* Match stats */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--accent)' }} />
            <span className="section-label">Live Match</span>
          </div>
          <button className="btn-ghost" onClick={handleHaptic} style={{ padding: '4px 8px' }}>
            <Bell size={12} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '10px' }}>Test</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: '4px' }}>
          <div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Over</p>
            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {matchState?.over || '—'}
            </p>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Score</p>
            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{matchState?.score || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Rewards</p>
            <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--accent)' }}>
              ₹{remaining >= 1000 ? `${(remaining / 1000).toFixed(0)}k` : remaining}
            </p>
          </div>
        </div>

        {typeof matchState?.mins_to_halftime === 'number' && matchState.mins_to_halftime >= 0 && (
          <div style={{
            marginTop: '12px', padding: '7px 12px',
            background: matchState.mins_to_halftime <= 10 ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${matchState.mins_to_halftime <= 10 ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Halftime in</span>
            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: matchState.mins_to_halftime <= 10 ? 'var(--danger)' : 'var(--warning)',
            }}>
              {matchState.mins_to_halftime}m
            </span>
          </div>
        )}
      </div>

      {/* Recent alerts */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Bell size={16} style={{ color: 'var(--accent)' }} />
          <span className="section-label">Recent Alerts</span>
          {relevantActions.length > 0 && (
            <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{relevantActions.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {relevantActions.length > 0 ? relevantActions.map(action => (
            <div key={action.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '2px', flexShrink: 0, alignSelf: 'stretch', minHeight: '28px',
                background: 'var(--accent)', borderRadius: '1px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: '0 0 3px', lineHeight: 1.5 }}>
                  {action.action}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {action.timestamp && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {action.incentive_inr > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 600 }}>
                      ₹{action.incentive_inr} voucher
                    </span>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, padding: '10px 0', textAlign: 'center' }}>
              No alerts for your zone
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
