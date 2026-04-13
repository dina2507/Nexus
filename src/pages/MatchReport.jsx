import React from 'react';
import { useNexus } from '../context/NexusContext';
import ImpactChart from '../components/ImpactChart';

const stakeholderOrder = ['security', 'fans', 'concessions', 'medical', 'transport'];

const stakeholderColors = {
  security:    '#ef4444',
  fans:        '#3b82f6',
  concessions: '#f59e0b',
  medical:     '#f97316',
  transport:   '#10b981',
};

export default function MatchReport() {
  const { actions, stadium, matchState } = useNexus();
  const reportActions = [...actions].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const total      = actions.length;
  const dispatched = actions.filter(a => a.status === 'dispatched').length;
  const reviewed   = actions.filter(a => a.status === 'approved' || a.status === 'rejected').length;

  const byStakeholder = stakeholderOrder.map((stakeholder) => {
    const items   = actions.filter(a => a.stakeholder === stakeholder);
    const highest = items.reduce((max, item) => Math.max(max, item.priority || 0), 0);
    return { stakeholder, count: items.length, highest };
  });

  const stats = [
    ['Total AI decisions',    total],
    ['Auto-dispatched',       dispatched],
    ['Human reviewed',        reviewed],
    ['Crowd risks prevented', '3 critical surges'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px 16px' }}>
      <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header */}
        <header className="card" style={{ padding: '24px' }}>
          <span className="badge badge-slate" style={{ marginBottom: '10px' }}>Post-Match Report</span>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            CSK vs MI · Chepauk · IPL 2026
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {stadium.name} · {matchState?.score || '0/0'} · {matchState?.weather || 'Weather unavailable'}
          </p>
        </header>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {stats.map(([label, value]) => (
            <div key={label} className="card" style={{ padding: '18px 20px' }}>
              <p className="section-label" style={{ margin: '0 0 8px' }}>{label}</p>
              <p style={{ fontSize: '22px', fontWeight: 600, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Stakeholder breakdown */}
        <section className="card" style={{ padding: '20px' }}>
          <p className="section-label" style={{ marginBottom: '14px' }}>Stakeholder breakdown</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {byStakeholder.map(({ stakeholder, count, highest }) => (
              <div
                key={stakeholder}
                className="card-hover"
                style={{
                  borderRadius: '10px', padding: '14px',
                  borderLeft: `3px solid ${stakeholderColors[stakeholder]}`,
                }}
              >
                <span className="badge" style={{
                  background: stakeholderColors[stakeholder] + '18',
                  color: stakeholderColors[stakeholder],
                  border: `1px solid ${stakeholderColors[stakeholder]}30`,
                  marginBottom: '10px',
                  textTransform: 'capitalize',
                }}>
                  {stakeholder}
                </span>
                <p style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 2px',
                  fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                  Highest priority: {highest || '—'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Impact chart */}
        <ImpactChart />

        {/* Top actions */}
        <section className="card" style={{ padding: '20px' }}>
          <p className="section-label" style={{ marginBottom: '14px' }}>Top actions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reportActions.slice(0, 10).map((action) => (
              <div
                key={action.id}
                className="card-hover"
                style={{ borderRadius: '10px', padding: '14px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge" style={{
                      background: (stakeholderColors[action.stakeholder] || '#64748b') + '18',
                      color: stakeholderColors[action.stakeholder] || '#64748b',
                      border: `1px solid ${(stakeholderColors[action.stakeholder] || '#64748b')}30`,
                      marginBottom: '6px', textTransform: 'capitalize',
                    }}>
                      {action.stakeholder}
                    </span>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                      {action.action}
                    </p>
                  </div>
                  <span className={`badge ${(action.priority || 0) >= 4 ? 'badge-red' : 'badge-slate'}`}
                    style={{ flexShrink: 0 }}>
                    P{action.priority || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', paddingBottom: '24px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
            Powered by Gemini 2.0 Flash · Google Cloud · Firebase
          </p>
        </footer>
      </div>
    </div>
  );
}
