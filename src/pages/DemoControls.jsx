import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, AlertTriangle, Flag, Zap } from 'lucide-react';

const scenarios = [
  {
    id: 'halftime',
    label: 'Simulate halftime surge',
    description: 'North Stand spikes to 91% — AI coordinates all 5 stakeholders',
    color: '#E24B4A',
    icon: Zap
  },
  {
    id: 'gate_emergency',
    label: 'Gate 7 blocked — emergency',
    description: 'Critical density event — human approval required',
    color: '#A32D2D',
    icon: AlertTriangle
  },
  {
    id: 'postmatch',
    label: 'Final whistle — exit surge',
    description: 'All zones spike to post-match levels',
    color: '#EF9F27',
    icon: Flag
  },
  {
    id: 'reset',
    label: 'Reset to pre-match',
    description: 'Returns all zones to baseline — minute -30',
    color: '#639922',
    icon: RotateCcw
  }
];

export default function DemoControls() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(null);

  async function triggerScenario(scenarioId) {
    setLoading(scenarioId);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const url = `${import.meta.env.VITE_FUNCTIONS_URL}/nexusTrigger`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stadiumId: 'chepauk', scenario: scenarioId })
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
    <div style={{ backgroundColor: '#050505', minHeight: '100vh', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ color: '#00f3ff', fontSize: '10px', fontWeight: 800, letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '8px' }}>
            Presentation Mode
          </div>
          <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 800, fontStyle: 'italic', margin: 0, letterSpacing: '-1px' }}>
            NEXUS Demo Controls
          </h1>
          <p style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
            Use these to trigger scenarios during your presentation
          </p>
        </div>

        {/* Scenario Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scenarios.map(s => {
            const Icon = s.icon;
            const isLoading = loading === s.id;
            return (
              <motion.button
                key={s.id}
                onClick={() => triggerScenario(s.id)}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
                  color: 'white',
                  padding: '18px 20px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isLoading ? 'wait' : 'pointer',
                  textAlign: 'left',
                  opacity: isLoading ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px'
                }}
              >
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  padding: '8px',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                    {isLoading ? 'Triggering...' : s.label}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.8, lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Scenario Log */}
        <div style={{ marginTop: '40px' }}>
          <h3 style={{ color: 'white', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>
            Scenario Log
          </h3>
          {logs.length === 0 ? (
            <div style={{ color: '#333', fontSize: '12px', fontStyle: 'italic' }}>
              No scenarios triggered yet...
            </div>
          ) : (
            logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 0',
                  borderBottom: '1px solid #1a1a1a',
                  fontSize: '12px'
                }}
              >
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: log.success ? '#639922' : '#E24B4A',
                  flexShrink: 0
                }} />
                <span style={{ color: '#666', fontFamily: 'monospace', fontSize: '10px' }}>
                  {log.time}
                </span>
                <span style={{ color: '#999', fontWeight: 600 }}>
                  {log.scenario}
                </span>
                <span style={{ color: log.success ? '#639922' : '#E24B4A', fontSize: '10px', marginLeft: 'auto' }}>
                  {log.success ? '✓ sent' : '✕ failed'}
                </span>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick Links */}
        <div style={{ marginTop: '40px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <a
            href="/"
            style={{ color: '#00f3ff', fontSize: '11px', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            ← Ops Dashboard
          </a>
          <span style={{ color: '#333' }}>|</span>
          <a
            href="/fan"
            style={{ color: '#00f3ff', fontSize: '11px', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Fan App →
          </a>
        </div>
      </div>
    </div>
  );
}
