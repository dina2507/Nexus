import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, AlertTriangle, Flag, Zap } from 'lucide-react';
import { fetchWithAuth } from '../components/auth';

const scenarios = [
  {
    id: 'halftime',
    label: 'Simulate halftime surge',
    description: 'North Stand spikes to 91% — AI coordinates all 5 stakeholders',
    color: '#ef4444',
    icon: Zap,
  },
  {
    id: 'gate_emergency',
    label: 'Gate 7 blocked — emergency',
    description: 'Critical density event — human approval required',
    color: '#dc2626',
    icon: AlertTriangle,
  },
  {
    id: 'postmatch',
    label: 'Final whistle — exit surge',
    description: 'All zones spike to post-match levels',
    color: '#f59e0b',
    icon: Flag,
  },
  {
    id: 'reset',
    label: 'Reset to pre-match',
    description: 'Returns all zones to baseline — minute -30',
    color: '#10b981',
    icon: RotateCcw,
  },
];

export default function DemoControls() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(null);

  async function triggerScenario(scenarioId) {
    setLoading(scenarioId);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
      const url  = `${import.meta.env.VITE_FUNCTIONS_URL}/nexusTrigger`;
      const resp = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stadiumId: import.meta.env.VITE_STADIUM_ID || 'chepauk', scenario: scenarioId }),
      });
      const result = await resp.json();
      setLogs(prev => [{ scenario: scenarioId, time: timestamp, success: true, detail: result }, ...prev].slice(0, 8));
    } catch (err) {
      console.error('Trigger failed:', err);
      setLogs(prev => [{ scenario: scenarioId, time: timestamp, success: false, detail: err.message }, ...prev].slice(0, 8));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{
      background: 'var(--bg-base)', minHeight: '100vh',
      padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span className="badge badge-slate" style={{ marginBottom: '12px' }}>Presentation Mode</span>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 8px',
            letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            NEXUS Demo Controls
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Trigger scenarios during your presentation
          </p>
        </div>

        {/* Scenario buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {scenarios.map(s => {
            const Icon = s.icon;
            const isLoading = loading === s.id;
            return (
              <motion.button
                key={s.id}
                onClick={() => triggerScenario(s.id)}
                disabled={!!loading}
                whileHover={{ scale: isLoading ? 1 : 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="scenario-btn"
              >
                <div className="scenario-icon" style={{ background: s.color + '18', color: s.color }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px',
                    color: 'var(--text-primary)' }}>
                    {isLoading ? 'Triggering…' : s.label}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Scenario log */}
        <div style={{ marginTop: '36px' }}>
          <p className="section-label" style={{ marginBottom: '12px' }}>Scenario log</p>
          {logs.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No scenarios triggered yet
            </p>
          ) : (
            logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                }}
              >
                <span className={`status-dot ${log.success ? 'live' : 'danger'}`} />
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0 }}>
                  {log.time}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.scenario}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, flexShrink: 0,
                  color: log.success ? 'var(--success)' : 'var(--danger)' }}>
                  {log.success ? '✓ sent' : '✕ failed'}
                </span>
              </motion.div>
            ))
          )}
        </div>

        {/* Navigation links */}
        <div style={{ marginTop: '36px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="/" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>
            ← Ops Dashboard
          </a>
          <span style={{ color: 'var(--border-default)' }}>|</span>
          <a href="/fan" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 500, textDecoration: 'none' }}>
            Fan App →
          </a>
        </div>
      </div>
    </div>
  );
}
