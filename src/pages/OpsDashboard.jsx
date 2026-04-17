import { useEffect, useState, useMemo } from 'react';
import { useNexus } from '../context/NexusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Zap, AlertTriangle, Terminal, Map, List, Pause, Play, Radio, Clock } from 'lucide-react';
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

const FEED_FILTERS = ['all', 'security', 'fans', 'concessions', 'medical', 'transport'];

// SVG semi-circle confidence gauge
function ConfidenceGauge({ confidence, enginePaused }) {
  const confPct = confidence !== null && confidence !== undefined ? Math.round(confidence * 100) : null;
  const C = Math.PI * 40; // half-circle at r=40
  const offset = confPct !== null ? C * (1 - confPct / 100) : C;
  const color = enginePaused ? 'var(--text-muted)'
    : confPct === null ? 'var(--text-muted)'
    : confPct >= 80 ? 'var(--success)'
    : confPct >= 60 ? 'var(--accent)'
    : confPct >= 40 ? 'var(--warning)'
    : 'var(--danger)';

  return (
    <div style={{ position: 'relative', width: '100px', height: '56px', flexShrink: 0 }}>
      <svg width="100" height="56" viewBox="0 0 100 56" style={{ overflow: 'visible' }}>
        <path d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C.toFixed(2)} strokeDashoffset={offset.toFixed(2)}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '16px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {confPct !== null ? `${confPct}%` : '—'}
        </span>
      </div>
    </div>
  );
}

const OpsDashboard = () => {
  const { stadium, densities, matchState, actions, loading, activeStadiumId } = useNexus();
  const [user, setUser] = useState(null);
  const [mobileTab, setMobileTab] = useState('map');
  const [overrideLoading, setOverrideLoading] = useState(null);
  const [enginePaused, setEnginePaused] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [feedFilter, setFeedFilter] = useState('all');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'nexus_state', 'engine'), (snap) => {
      setEnginePaused(Boolean(snap.data()?.paused));
    });
    return () => unsub();
  }, []);

  // Auto-dismiss toast after 3.5 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function togglePause() {
    try {
      await setDoc(doc(db, 'nexus_state', 'engine'),
        { paused: !enginePaused, paused_at: new Date().toISOString() }, { merge: true });
      setToast({ message: enginePaused ? 'AI Engine resumed' : 'AI Engine paused', type: enginePaused ? 'success' : 'warning' });
    } catch {
      setToast({ message: 'Failed to toggle AI state', type: 'error' });
    }
  }

  async function triggerEmergencyBroadcast() {
    if (broadcastLoading) return;
    if (!window.confirm('Broadcast emergency alert to ALL registered fans?')) return;
    setBroadcastLoading(true);
    try {
      await fetchWithAuth(`${import.meta.env.VITE_FUNCTIONS_URL}/nexusTrigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stadiumId: activeStadiumId, emergencyBroadcast: true, confirmCode: 'EMERGENCY' }),
      });
      setToast({ message: 'Emergency broadcast sent to all fans', type: 'success' });
    } catch {
      setToast({ message: 'Broadcast failed', type: 'error' });
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
      setToast({ message: `${a.label} dispatched`, type: 'success' });
    } catch {
      setToast({ message: 'Dispatch failed — check connection', type: 'error' });
    } finally {
      setOverrideLoading(null);
    }
  }

  const avgDensity = Object.values(densities).length > 0
    ? Object.values(densities).reduce((sum, z) => sum + (z.pct || 0), 0) / Object.values(densities).length
    : 0;
  const pressureIndex = (avgDensity * 10).toFixed(1);
  const pressureColor = pressureIndex > 7 ? 'var(--danger)' : pressureIndex > 5 ? 'var(--warning)' : 'var(--success)';

  const mapDensities = useMemo(
    () => Object.fromEntries(Object.entries(densities).map(([id, d]) => [id, d.pct || 0])),
    [densities]
  );
  const matchClock = formatMatchClock(matchState);

  // Budget
  const maxBudget = stadium?.incentive_config?.max_budget_per_match_inr || 200000;
  const remaining = matchState?.remaining_budget ?? maxBudget;
  const budgetPctUsed = Math.min(100, Math.round(((maxBudget - remaining) / maxBudget) * 100));

  // AI status
  const latestAction = actions[0];
  const latestConfidence = latestAction?.confidence ?? null;
  const topPriority = actions.reduce((max, a) => Math.max(max, a.priority || 0), 0);
  const threatLevel = topPriority >= 5 ? 'Critical' : topPriority >= 4 ? 'High' : topPriority >= 3 ? 'Moderate' : 'Normal';
  const threatColor = topPriority >= 5 ? 'var(--danger)' : topPriority >= 4 ? '#ef4444' : topPriority >= 3 ? 'var(--warning)' : 'var(--success)';
  const timeSince = latestAction?.timestamp
    ? Math.floor((Date.now() - new Date(latestAction.timestamp).getTime()) / 1000)
    : null;

  // Filtered feed
  const filteredActions = feedFilter === 'all' ? actions : actions.filter(a => a.stakeholder === feedFilter);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '2px solid rgba(59,130,246,0.25)', borderTopColor: 'var(--accent)',
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

      {/* AI Engine Status — confidence gauge + threat level */}
      <section className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <Shield size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span className="section-label">AI Engine</span>
          <span style={{
            marginLeft: 'auto', fontSize: '9px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', color: threatColor,
            padding: '2px 8px', borderRadius: '99px',
            background: threatColor + '18', border: `1px solid ${threatColor}30`,
          }}>
            {threatLevel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <ConfidenceGauge confidence={latestConfidence} enginePaused={enginePaused} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
              Confidence
            </div>
            {latestAction?.risk_assessment ? (
              <p style={{
                fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 8px',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {latestAction.risk_assessment}
              </p>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                {enginePaused ? 'Engine paused — no new assessments' : 'Monitoring — awaiting data'}
              </p>
            )}
            {timeSince !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {timeSince < 60 ? `${timeSince}s ago` : `${Math.floor(timeSince / 60)}m ago`}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );

  // ── Center column ─────────────────────────────────────────
  const centerCol = (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Threat Level Banner */}
      <div style={{
        padding: '10px 16px',
        background: threatColor + '0e',
        border: `1px solid ${threatColor}22`,
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%', background: threatColor,
          boxShadow: `0 0 7px ${threatColor}`, flexShrink: 0,
          animation: topPriority >= 4 ? 'pulse 1.5s ease infinite' : 'none',
        }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: threatColor,
          textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, minWidth: 0 }}>
          {threatLevel} · Pressure {pressureIndex}/10
        </span>
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          {Object.entries(densities).slice(0, 5).map(([zoneId, d]) => {
            const pct = Math.round((d.pct || 0) * 100);
            const c = pct >= 93 ? 'var(--danger)' : pct >= 82 ? '#ef4444' : pct >= 70 ? 'var(--warning)' : 'var(--success)';
            return (
              <div key={zoneId} style={{
                fontSize: '9px', fontWeight: 700, color: c,
                padding: '2px 6px', borderRadius: '4px', background: c + '18',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {pct}%
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', minHeight: '380px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '6px' }}>
          <span className="badge badge-blue">Live Map</span>
          <span className="badge badge-slate">{stadium?.name || 'Chepauk'}</span>
        </div>
        <StadiumMap crowdDensity={mapDensities} />
      </div>
      <ImpactChart />
    </motion.div>
  );

  // ── Right column ──────────────────────────────────────────
  const rightCol = (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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

        <div style={{ padding: '10px 12px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button className="btn-ghost" onClick={togglePause}
            aria-label={enginePaused ? 'Resume NEXUS AI engine' : 'Pause NEXUS AI engine'}
            style={{
              padding: '8px 6px', fontSize: '11px', justifyContent: 'center', gap: '5px',
              color: enginePaused ? 'var(--success)' : 'var(--warning)',
              borderColor: enginePaused ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
            }}
          >
            {enginePaused ? <Play size={12} /> : <Pause size={12} />}
            {enginePaused ? 'Resume AI' : 'Pause AI'}
          </button>
          <button className="btn-ghost" onClick={triggerEmergencyBroadcast} disabled={broadcastLoading}
            aria-label="Trigger emergency broadcast to all fans"
            style={{
              padding: '8px 6px', fontSize: '11px', justifyContent: 'center', gap: '5px',
              color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <Radio size={12} />
            {broadcastLoading ? 'Sending…' : 'Emergency'}
          </button>
        </div>

        <div style={{ padding: '8px 12px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {OVERRIDE_ACTIONS.map(a => {
            const color = getStakeholderColor(a.stakeholder);
            return (
              <button key={a.id} onClick={() => dispatchOverride(a)} disabled={overrideLoading !== null}
                title={a.action} aria-label={a.action}
                style={{
                  padding: '9px 8px', fontSize: '11px', fontWeight: 600,
                  fontFamily: 'Outfit, sans-serif', textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  background: color + '12', border: `1px solid ${color}28`,
                  borderLeft: `3px solid ${color}`, color, borderRadius: '8px',
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

      {/* Response Feed with stakeholder filter tabs */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '300px', overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px 8px', borderBottom: '1px solid var(--border-subtle)',
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

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '3px', padding: '7px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {FEED_FILTERS.map(s => {
            const isActive = feedFilter === s;
            const color = s === 'all' ? 'var(--accent)' : getStakeholderColor(s);
            return (
              <button key={s} onClick={() => setFeedFilter(s)}
                style={{
                  padding: '3px 9px', borderRadius: '99px', fontSize: '10px', fontWeight: 600,
                  textTransform: 'capitalize', whiteSpace: 'nowrap', cursor: 'pointer',
                  border: `1px solid ${isActive ? color + '40' : 'transparent'}`,
                  background: isActive ? color + '18' : 'transparent',
                  color: isActive ? color : 'var(--text-muted)',
                  transition: 'all 0.15s', fontFamily: 'Outfit, sans-serif',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
          <AnimatePresence initial={false}>
            {filteredActions.length > 0 ? filteredActions.map((action, idx) => {
              const color = getStakeholderColor(action.stakeholder);
              return (
                <motion.div key={action.id || idx} initial={{ x: 16, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ width: '3px', borderRadius: '2px', flexShrink: 0, alignSelf: 'stretch',
                    background: color, minHeight: '36px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 8px', borderRadius: '9999px',
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'capitalize',
                        background: color + '18', color, border: `1px solid ${color}30`,
                      }}>
                        {action.stakeholder}
                      </span>
                      <span style={{
                        marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
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
                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: '0 0 5px', lineHeight: 1.55 }}>
                      {action.action}
                    </p>
                    {/* Detail row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {action.target_zone && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {action.target_zone.replace(/_/g, ' ')}
                        </span>
                      )}
                      {action.incentive_inr > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 600 }}>
                          ₹{action.incentive_inr}
                        </span>
                      )}
                      {action.confidence && (
                        <span style={{ fontSize: '10px', color: 'var(--accent)' }}>
                          {Math.round(action.confidence * 100)}% conf
                        </span>
                      )}
                      {action.timestamp && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            }) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                {feedFilter === 'all' ? 'Waiting for NEXUS decisions…' : `No ${feedFilter} actions yet`}
              </div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </motion.div>
  );

  const MOBILE_TABS = [
    { id: 'map',     label: 'Map',     Icon: Map   },
    { id: 'zones',   label: 'Zones',   Icon: Users  },
    { id: 'actions', label: 'Actions', Icon: List   },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ─── Toast notification ─── */}
      <AnimatePresence>
        {toast && (
          <div style={{
            position: 'fixed', top: '68px', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', zIndex: 200, pointerEvents: 'none',
          }}>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              style={{
                pointerEvents: 'auto',
                padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                backdropFilter: 'blur(16px)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                background: toast.type === 'success' ? 'rgba(16,185,129,0.15)'
                  : toast.type === 'warning' ? 'rgba(251,191,36,0.15)'
                  : 'rgba(244,63,94,0.15)',
                border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.35)'
                  : toast.type === 'warning' ? 'rgba(251,191,36,0.35)'
                  : 'rgba(244,63,94,0.35)'}`,
                color: toast.type === 'success' ? 'var(--success)'
                  : toast.type === 'warning' ? 'var(--warning)'
                  : 'var(--danger)',
              }}
            >
              {toast.message}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Sticky Header ─── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 16px', height: '56px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(10,15,30,0.97)', backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0, gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* NEXUS hexagon icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
              <polygon points="14,2 25,8 25,20 14,26 3,20 3,8"
                fill="rgba(14,165,233,0.1)" stroke="rgba(14,165,233,0.55)" strokeWidth="1.5" />
              <polygon points="14,7 20,10.5 20,17.5 14,21 8,17.5 8,10.5"
                fill="none" stroke="rgba(14,165,233,0.3)" strokeWidth="1" />
              <circle cx="14" cy="14" r="3" fill="var(--accent)" />
              <line x1="14" y1="2"  x2="14" y2="7"    stroke="var(--accent)" strokeWidth="1" opacity="0.55" />
              <line x1="25" y1="8"  x2="20" y2="10.5" stroke="var(--accent)" strokeWidth="1" opacity="0.55" />
              <line x1="25" y1="20" x2="20" y2="17.5" stroke="var(--accent)" strokeWidth="1" opacity="0.55" />
              <line x1="14" y1="26" x2="14" y2="21"   stroke="var(--accent)" strokeWidth="1" opacity="0.55" />
              <line x1="3"  y1="20" x2="8"  y2="17.5" stroke="var(--accent)" strokeWidth="1" opacity="0.55" />
              <line x1="3"  y1="8"  x2="8"  y2="10.5" stroke="var(--accent)" strokeWidth="1" opacity="0.55" />
            </svg>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1 }}>NEXUS</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                <StadiumPicker />
              </div>
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
          <span className="kpi-value">₹{(remaining || 0).toLocaleString()}</span>
          <div style={{ marginTop: '4px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '99px', transition: 'width 0.6s ease',
              background: budgetPctUsed >= 80 ? 'var(--danger)' : budgetPctUsed >= 50 ? 'var(--warning)' : 'var(--success)',
              width: `${budgetPctUsed}%`,
            }} />
          </div>
        </div>
        <div className="kpi-card">
          <span className="stat-label">Pressure</span>
          <span className="kpi-value" style={{ color: pressureColor }}>{pressureIndex}</span>
          <div style={{ marginTop: '4px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '99px', transition: 'width 0.6s ease',
              background: pressureColor,
              width: `${Math.min(100, parseFloat(pressureIndex) * 10)}%`,
            }} />
          </div>
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
          <button key={id} onClick={() => setMobileTab(id)}
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
  if (minute < 0)    return `Pre-match · T-${Math.abs(minute)} min`;
  if (minute < 45)   return `1st innings · Over ${Math.floor(minute / 3.75)}`;
  if (minute < 60)   return 'Halftime';
  if (minute <= 110) return `2nd innings · Over ${Math.floor((minute - 60) / 2.5)}`;
  return 'Post-match';
}

export default OpsDashboard;
