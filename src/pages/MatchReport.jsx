import { useState } from 'react';
import { useNexus } from '../context/NexusContext';
import ImpactChart from '../components/ImpactChart';
import { usePDF } from 'react-to-pdf';
import { ArrowLeft, Shield, Users, Coffee, Heart, Bus } from 'lucide-react';

const stakeholderOrder = ['security', 'fans', 'concessions', 'medical', 'transport'];
const stakeholderColors = {
  security: '#ef4444',
  fans: '#3b82f6',
  concessions: '#f59e0b',
  medical: '#f97316',
  transport: '#10b981',
};
const stakeholderIcons = { security: Shield, fans: Users, concessions: Coffee, medical: Heart, transport: Bus };

function statusColor(status) {
  switch (status?.toLowerCase()) {
    case 'dispatched': case 'approved': return '#10b981';
    case 'pending': return '#f59e0b';
    case 'rejected': return '#ef4444';
    default: return '#475569';
  }
}

export default function MatchReport() {
  const { actions, stadium, matchState } = useNexus();
  const { toPDF, targetRef } = usePDF({ filename: 'nexus-match-report.pdf' });
  const [pdfCapturing, setPdfCapturing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function handleExportPDF() {
    setPdfCapturing(true);
    await new Promise(r => setTimeout(r, 800));
    await toPDF();
    setPdfCapturing(false);
  }

  const reportActions = [...actions].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const total = actions.length;
  const dispatched = actions.filter(a => a.status === 'dispatched').length;
  const reviewed = actions.filter(a => a.status === 'approved' || a.status === 'rejected').length;
  const criticalCount = actions.filter(a => (a.priority || 0) >= 4).length;

  const withConfidence = actions.filter(a => typeof a.confidence === 'number');
  const avgConfidence = withConfidence.length > 0
    ? (withConfidence.reduce((s, a) => s + a.confidence, 0) / withConfidence.length * 100).toFixed(0)
    : '—';

  const byStakeholder = stakeholderOrder.map(stakeholder => {
    const items = actions.filter(a => a.stakeholder === stakeholder);
    const highest = items.reduce((max, item) => Math.max(max, item.priority || 0), 0);
    return { stakeholder, count: items.length, highest };
  });

  const maxBudget = stadium?.incentive_config?.max_budget_per_match_inr || 200000;
  const remaining = Math.max(0, matchState?.remaining_budget ?? maxBudget);
  const spent = Math.max(0, maxBudget - remaining);
  const budgetPct = Math.min(100, Math.round((spent / maxBudget) * 100));

  const top3 = [...actions]
    .filter(a => a.status === 'dispatched' || a.status === 'approved')
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 3);

  const stats = [
    ['Total AI decisions', total],
    ['Auto-dispatched', dispatched],
    ['Critical actions (P4+)', criticalCount],
    ['Avg AI confidence', avgConfidence !== '—' ? `${avgConfidence}%` : '—'],
    ['Human reviewed', reviewed],
    ['Budget utilized', `₹${spent.toLocaleString()}`],
  ];

  const homeTeam = matchState?.home_team || 'CSK';
  const awayTeam = matchState?.away_team || 'MI';
  const reportDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const displayedActions = showAll ? reportActions : reportActions.slice(0, 8);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px 16px' }}>
      <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Header */}
        <header className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span className="badge badge-slate">Post-Match Report</span>
              <span className="badge badge-blue">IPL 2026</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{reportDate}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {homeTeam} vs {awayTeam}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              {stadium?.name || 'MA Chidambaram Stadium'} · {matchState?.score || '0/0'} · {matchState?.weather || 'Weather unavailable'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
            <a href="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'none',
              padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-default)'
            }}>
              <ArrowLeft size={13} /> Dashboard
            </a>
            <button className="btn-primary" onClick={handleExportPDF} disabled={pdfCapturing} style={{ padding: '8px 16px' }}>
              {pdfCapturing ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
        </header>

        <div ref={targetRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-base)' }}>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {stats.map(([label, value]) => (
              <div key={label} className="card" style={{ padding: '18px 20px' }}>
                <p className="section-label" style={{ margin: '0 0 8px' }}>{label}</p>
                <p style={{ fontSize: '22px', fontWeight: 600, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Budget utilization */}
          <section className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p className="section-label" style={{ margin: 0 }}>Budget Utilization</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ₹{spent.toLocaleString()} / ₹{maxBudget.toLocaleString()}
                </span>
                <span style={{
                  fontSize: '13px', fontWeight: 700,
                  color: budgetPct >= 80 ? 'var(--danger)' : budgetPct >= 50 ? 'var(--warning)' : 'var(--success)',
                }}>
                  {budgetPct}%
                </span>
              </div>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '99px',
                background: budgetPct >= 80 ? 'var(--danger)' : budgetPct >= 50 ? 'var(--warning)' : 'var(--success)',
                width: `${budgetPct}%`, transition: 'width 0.8s ease',
              }} />
            </div>
          </section>

          {/* Stakeholder breakdown */}
          <section className="card" style={{ padding: '20px' }}>
            <p className="section-label" style={{ marginBottom: '14px' }}>Stakeholder Breakdown</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {byStakeholder.map(({ stakeholder, count, highest }) => {
                const Icon = stakeholderIcons[stakeholder] || Shield;
                const color = stakeholderColors[stakeholder];
                return (
                  <div key={stakeholder} className="card-hover"
                    style={{ borderRadius: '10px', padding: '14px', borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                      <Icon size={12} style={{ color }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'capitalize' }}>
                        {stakeholder}
                      </span>
                    </div>
                    <p style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                      Peak P{highest || '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Impact chart */}
          <ImpactChart />

          {/* Top interventions */}
          <section className="card" style={{ padding: '20px' }}>
            <p className="section-label" style={{ marginBottom: '14px' }}>Top Interventions by Impact</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(top3.length > 0 ? top3 : reportActions.slice(0, 3)).map((action) => (
                <div key={action.id} className="card-hover" style={{ borderRadius: '10px', padding: '14px' }}>
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
                    <span className={`badge ${(action.priority || 0) >= 4 ? 'badge-red' : 'badge-slate'}`} style={{ flexShrink: 0 }}>
                      P{action.priority || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Full action log */}
          <section className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p className="section-label" style={{ margin: 0 }}>Full Action Log</p>
              <span className="badge badge-slate">{total} total</span>
            </div>
            {reportActions.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No actions recorded yet
              </p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                        {['Time', 'Stakeholder', 'Action', 'Zone', 'P', 'Status', 'Conf'].map(h => (
                          <th key={h} style={{
                            padding: '8px 10px', textAlign: 'left', fontSize: '10px',
                            fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)',
                            textTransform: 'uppercase', whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedActions.map((a, i) => {
                        const color = stakeholderColors[a.stakeholder] || '#64748b';
                        return (
                          <tr key={a.id || i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{
                              padding: '8px 10px', color: 'var(--text-muted)',
                              fontFamily: 'monospace', fontSize: '10px', whiteSpace: 'nowrap'
                            }}>
                              {a.timestamp
                                ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'capitalize' }}>
                                {a.stakeholder}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: '260px' }}>
                              <span style={{
                                display: '-webkit-box', WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical', overflow: 'hidden'
                              }}>
                                {a.action}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {a.target_zone ? a.target_zone.replace(/_/g, ' ') : '—'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 700,
                                color: (a.priority || 0) >= 4 ? 'var(--danger)' : 'var(--text-muted)'
                              }}>
                                P{a.priority || 0}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: statusColor(a.status) }}>
                                {a.status}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--accent)', fontSize: '11px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {a.confidence ? `${Math.round(a.confidence * 100)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {reportActions.length > 8 && (
                  <button onClick={() => setShowAll(v => !v)} className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>
                    {showAll ? 'Show less' : `Show all ${reportActions.length} actions`}
                  </button>
                )}
              </>
            )}
          </section>

          {/* Footer */}
          <footer style={{ textAlign: 'center', paddingBottom: '24px', paddingTop: '8px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.03em', margin: 0 }}>
              Powered by Gemini 2.0 Flash · Google Cloud · Firebase
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
