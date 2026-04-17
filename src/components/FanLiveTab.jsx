import { Activity, Bell } from 'lucide-react';

export default function FanLiveTab({ matchState, actions, fanProfile }) {
  const handleHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const relevantActions = actions
    .filter(a => a.stakeholder === 'fans' && (!a.target_zone || a.target_zone === fanProfile?.zone_id))
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
