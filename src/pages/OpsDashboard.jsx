import { useEffect, useState, useMemo } from 'react';
import { useNexus } from '../context/NexusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Zap, AlertTriangle, Terminal, Map, List, Pause, Play, Radio } from 'lucide-react';
import StadiumMap from '../components/StadiumMap';
import ZoneDensityBars from '../components/ZoneDensityBars';
import ImpactChart from '../components/ImpactChart';
import ApprovalQueue from '../components/ApprovalQueue';
import GateActivityPanel from '../components/GateActivityPanel';
import WeatherPill from '../components/WeatherPill';
import StadiumPicker from '../components/StadiumPicker';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { fetchWithAuth } from '../components/auth';

const OVERRIDE_ACTIONS = [
  { id: 'gate',    stakeholder: 'security',  action: 'Open Gate G8 — redirect north exit flow',         label: 'Open Gate G8'   },
  { id: 'medical', stakeholder: 'medical',   action: 'Call medical standby to North Stand corridor',     label: 'Medical Stand N' },
  { id: 'fan',     stakeholder: 'fans',      action: 'Move to West Block — less crowded, faster exit',   label: 'Push Fan Nudge'  },
  { id: 'bus',     stakeholder: 'transport', action: 'Hold 5 buses at Gate 7 for 20 minutes',            label: 'Hold Buses'      },
];

const OpsDashboard = () => {
  const { stadium, densities, matchState, actions, loading, activeStadiumId } = useNexus();
  const [user, setUser] = useState(null);
  const [mobileTab, setMobileTab] = useState('map');
  const [overrideLoading, setOverrideLoading] = useState(null);
  const [enginePaused, setEnginePaused] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  // Subscribe to engine pause state so the toggle stays in sync with Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'nexus_state', 'engine'), (snap) => {
      setEnginePaused(Boolean(snap.data()?.paused));
    });
    return () => unsub();
  }, []);

  async function togglePause() {
    try {
      await setDoc(
        doc(db, 'nexus_state', 'engine'),
        { paused: !enginePaused, paused_at: new Date().toISOString() },
        { merge: true }
      );
    } catch (err) {
      console.error('Pause toggle failed:', err);
    }
  }

  async function triggerEmergencyBroadcast() {
    if (broadcastLoading) return;
    const confirmed = window.confirm('Broadcast emergency alert to ALL registered fans?');
    if (!confirmed) return;
    setBroadcastLoading(true);
    try {
      await fetchWithAuth(`${import.meta.env.VITE_FUNCTIONS_URL}/nexusTrigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stadiumId: activeStadiumId, emergencyBroadcast: true, confirmCode: 'EMERGENCY' }),
      });
    } catch (err) {
      console.error('Emergency broadcast failed:', err);
    } finally {
      setBroadcastLoading(false);
    }
  }

  async function dispatchOverride(a) {
    setOverrideLoading(a.id);
    try {
      await fetchWithAuth(`${import.meta.env.VITE_FUNCTIONS_URL}/nexusTrigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stadiumId: activeStadiumId,
          manualAction: { stakeholder: a.stakeholder, action: a.action, priority: 3 },
        }),
      });
    } catch (err) {
      console.error('Override failed:', err);
    } finally {
      setOverrideLoading(null);
    }
  }

  const avgDensity = Object.values(densities).length > 0
    ? Object.values(densities).reduce((sum, z) => sum + (z.pct || 0), 0) / Object.values(densities).length
    : 0;
  const pressureIndex = (avgDensity * 10).toFixed(1);
  const pressureColor = pressureIndex > 7 ? 'var(--danger)' : pressureIndex > 5 ? 'var(--warning)' : 'var(--success)';
  const latestRisk = actions.length > 0 ? actions[0]?.risk_assessment : null;

  const mapDensities = useMemo(
    () => Object.fromEntries(Object.entries(densities).map(([id, d]) => [id, d.pct || 0])),
    [densities]
  );
  const matchClock = formatMatchClock(matchState);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '2px solid rgba(59,130,246,0.25)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          Connecting to NEXUS…
        </span>
      </div>
    </div>
  );

  // ── Left column ──────────────────────────────────────────
  const leftCol = (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <section className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <Users size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span className="section-label">Zone Density</span>
        </div>
        <ZoneDensityBars zones={stadium.zones} densities={densities} crushThreshold={stadium.crush_threshold} />
      </section>

      <GateActivityPanel />

      <section className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <Shield size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span className="section-label">AI Risk Assessment</span>
        </div>
        {latestRisk ? (
          <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
              &quot;{latestRisk}&quot;
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            System monitoring — no assessment yet
          </p>
        )}
        {actions[0]?.confidence && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              Confidence
            </span>
            <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '99px', background: 'var(--accent)',
                width: `${(actions[0].confidence * 100)}%`, transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {(actions[0].confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </section>
    </motion.div>
  );

  // ── Center column ─────────────────────────────────────────
  const centerCol = (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ overflow: 'hidden', minHeight: '380px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
          <span className="badge badge-blue">Live Map</span>
          <span className="badge badge-slate">{stadium?.name || 'Chepauk'} v2.1</span>
        </div>
        <StadiumMap crowdDensity={mapDensities} />
      </div>
      <ImpactChart />
    </motion.div>
  );

  // ── Right column ──────────────────────────────────────────
  const rightCol = (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 160px)' }}>

      {/* Operator Override */}
      <section className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: '7px', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Terminal size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <span className="section-label">Operator Override</span>
          </div>
          {enginePaused && <span className="badge badge-amber">AI Paused</span>}
        </div>

        {/* Kill-switch row */}
        <div style={{ padding: '10px 12px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            className="btn-ghost"
            onClick={togglePause}
            aria-label={enginePaused ? 'Resume NEXUS AI engine' : 'Pause NEXUS AI engine'}
            style={{
              padding: '8px 6px', fontSize: '11px', justifyContent: 'center', textAlign: 'center',
              gap: '5px', color: enginePaused ? 'var(--success)' : 'var(--warning)',
              borderColor: enginePaused ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
            }}
          >
            {enginePaused ? <Play size={12} /> : <Pause size={12} />}
            {enginePaused ? 'Resume AI' : 'Pause AI'}
          </button>
          <button
            className="btn-ghost"
            onClick={triggerEmergencyBroadcast}
            disabled={broadcastLoading}
            aria-label="Trigger emergency broadcast to all fans"
            style={{
              padding: '8px 6px', fontSize: '11px', justifyContent: 'center', textAlign: 'center',
              gap: '5px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <Radio size={12} />
            {broadcastLoading ? 'Sending…' : 'Emergency'}
          </button>
        </div>

        {/* Stakeholder-colored quick-dispatch buttons */}
        <div style={{ padding: '8px 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {OVERRIDE_ACTIONS.map(a => {
            const color = getStakeholderColor(a.stakeholder);
            return (
              <button
                key={a.id}
                onClick={() => dispatchOverride(a)}
                disabled={overrideLoading !== null}
                title={a.action}
                aria-label={a.action}
                style={{
                  padding: '9px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  background: color + '12',
                  border: `1px solid ${color}28`,
                  borderLeft: `3px solid ${color}`,
                  color: color,
                  borderRadius: '8px',
                  cursor: overrideLoading !== null ? 'wait' : 'pointer',
                  transition: 'background 0.15s, opacity 0.15s',
                  opacity: overrideLoading !== null && overrideLoading !== a.id ? 0.5 : 1,
                }}
              >
                {overrideLoading === a.id ? '…' : a.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Approval Queue */}
      <section className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: '7px',
        }}>
          <AlertTriangle size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span className="section-label">Pending Approvals</span>
        </div>
        <div style={{ padding: '12px' }}>
          <ApprovalQueue stadiumId={activeStadiumId} />
        </div>
      </section>

      {/* Response Feed */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Zap size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="section-label">Response Feed</span>
          </div>
          <span className="badge badge-green">
            <span className="status-dot live" style={{ animation: 'pulse 2s ease infinite' }} /> Live
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
          <AnimatePresence initial={false}>
            {actions.length > 0 ? actions.map((action, idx) => {
              const color = getStakeholderColor(action.stakeholder);
              return (
                <motion.div
                  key={action.id || idx}
                  initial={{ x: 16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{
                    width: '3px', borderRadius: '2px', flexShrink: 0, alignSelf: 'stretch',
                    background: color, minHeight: '36px',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 8px', borderRadius: '9999px',
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
                        textTransform: 'capitalize',
                        background: color + '18',
                        color: color,
                        border: `1px solid ${color}30`,
                      }}>
                        {action.stakeholder}
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: '10px', fontWeight: 600,
                        padding: '2px 6px', borderRadius: '4px',
                        color: action.priority >= 4 ? 'var(--danger)' : 'var(--text-muted)',
                        background: action.priority >= 4 ? 'var(--danger-dim)' : 'rgba(255,255,255,0.04)',
                      }}>
                        P{action.priority}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: getStatusColor(action.status) }}>
                        {action.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1.55 }}>
                      {action.action}
                    </p>
                    {action.timestamp && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                        {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            }) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Waiting for NEXUS decisions…
              </div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </motion.div>
  );

  const MOBILE_TABS = [
    { id: 'map',    label: 'Map',     Icon: Map  },
    { id: 'zones',  label: 'Zones',   Icon: Users },
    { id: 'actions', label: 'Actions', Icon: List  },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ─── Sticky Header ─── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 16px', height: '56px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(10,15,30,0.97)', backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0, gap: '12px',
      }}>
        {/* Left: brand + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>NEXUS</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
              <StadiumPicker />
            </div>
          </div>
          <div style={{ width: '1px', height: '28px', background: 'var(--border-subtle)', flexShrink: 0 }} />
          <span className="badge badge-green"><span className="status-dot live" /> Live</span>
          <span className="badge badge-blue ops-match-clock">{matchClock}</span>
          {typeof matchState?.mins_to_halftime === 'number' && matchState.mins_to_halftime >= 0 && matchState.mins_to_halftime <= 15 && (
            <span className="badge badge-amber ops-match-clock">T-{matchState.mins_to_halftime}m</span>
          )}
          {enginePaused && <span className="badge badge-amber ops-match-clock">AI Paused</span>}
        </div>

        {/* Right: user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span className="ops-user-email" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {user?.email || 'Operator'}
          </span>
          <button className="btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      {/* ─── KPI Strip ─── */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <span className="stat-label">Score</span>
          <span className="kpi-value">{matchState?.score || '—'}</span>
        </div>
        <div className="kpi-card">
          <span className="stat-label">Over</span>
          <span className="kpi-value">{matchState?.over ?? '—'}</span>
        </div>
        <div className="kpi-card">
          <span className="stat-label">Halftime</span>
          <span className="kpi-value" style={{
            color: (matchState?.mins_to_halftime ?? 99) <= 10 ? 'var(--danger)' : 'var(--warning)',
          }}>
            {matchState?.mins_to_halftime ?? '—'}m
          </span>
        </div>
        <div className="kpi-card">
          <span className="stat-label">Budget</span>
          <span className="kpi-value">₹{(matchState?.remaining_budget || 0).toLocaleString()}</span>
        </div>
        <div className="kpi-card">
          <span className="stat-label">Pressure</span>
          <span className="kpi-value" style={{ color: pressureColor }}>{pressureIndex}</span>
        </div>
        <div className="kpi-card kpi-weather">
          <WeatherPill />
        </div>
      </div>

      {/* ─── Main content ─── */}
      <main style={{ flex: 1, maxWidth: '1600px', width: '100%', margin: '0 auto', padding: '16px 16px 80px' }}>
        <div className="ops-grid">
          <div className="ops-col" data-tab="zones" data-active={mobileTab === 'zones' || undefined}>
            {leftCol}
          </div>
          <div className="ops-col ops-col-center" data-tab="map" data-active={mobileTab === 'map' || undefined}>
            {centerCol}
          </div>
          <div className="ops-col" data-tab="actions" data-active={mobileTab === 'actions' || undefined}>
            {rightCol}
          </div>
        </div>
      </main>

      {/* ─── Mobile tab bar ─── */}
      <nav className="ops-mobile-tabs">
        {MOBILE_TABS.map(({ id, label, Icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 20px',
              color: mobileTab === id ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            <TabIcon size={20} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

function getStakeholderColor(stakeholder) {
  switch (stakeholder?.toLowerCase()) {
    case 'security':    return '#ef4444';
    case 'fans':        return '#3b82f6';
    case 'concessions': return '#f59e0b';
    case 'medical':     return '#f97316';
    case 'transport':   return '#10b981';
    default:            return '#64748b';
  }
}

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'dispatched': case 'approved': return '#10b981';
    case 'pending':  return '#f59e0b';
    case 'rejected': return '#ef4444';
    default:         return '#475569';
  }
}

function formatMatchClock(matchState) {
  const minute = matchState?.match_minute;
  if (minute === null || minute === undefined) return 'Awaiting match clock';
  if (minute < 0)   return `Pre-match · T-${Math.abs(minute)} min`;
  if (minute < 45)  return `1st innings · Over ${Math.floor(minute / 3.75)}`;
  if (minute < 60)  return 'Halftime';
  if (minute <= 110) return `2nd innings · Over ${Math.floor((minute - 60) / 2.5)}`;
  return 'Post-match';
}

export default OpsDashboard;
