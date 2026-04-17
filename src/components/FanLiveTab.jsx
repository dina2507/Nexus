import { Activity, Bell, Users } from 'lucide-react';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Zone density card */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Users size={16} style={{ color: densityColor(myZoneDensity) }} />
          <span className="section-label">Your Zone — Live</span>
          <span style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
            color: densityColor(myZoneDensity),
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {densityLabel(myZoneDensity)}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{zoneLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${pctDisplay}%`, height: '100%',
              background: densityColor(myZoneDensity),
              borderRadius: '4px',
              transition: 'width 0.6s ease, background 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: '18px', fontWeight: 700, color: densityColor(myZoneDensity), minWidth: '42px', textAlign: 'right' }}>
            {pctDisplay}%
          </span>
        </div>
      </div>

      {/* Match stats */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--accent)' }}/>
            <span className="section-label">Live Match</span>
          </div>
          <button className="btn-ghost" onClick={handleHaptic} style={{ padding: '6px' }}>
            <Bell size={14} style={{ color: 'var(--text-muted)' }}/>
            <span style={{ fontSize: '10px' }}>Test Alert</span>
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Over</p>
            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{matchState?.over || '-'}</p>
          </div>
          <div style={{ width: '1px', height: '30px', background: 'var(--border-subtle)' }} />
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase' }}>Score</p>
            <p style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{matchState?.score || '-'}</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Bell size={16} style={{ color: 'var(--accent)' }}/>
          <span className="section-label">Recent Alerts</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {relevantActions.length > 0 ? relevantActions.map(action => (
            <div key={action.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '2px', height: '100%', background: 'var(--accent)' }} />
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>{action.action}</p>
                {action.timestamp && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          )) : (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, padding: '10px 0', textAlign: 'center' }}>
              No alerts for your zone.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
