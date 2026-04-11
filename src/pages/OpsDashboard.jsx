import React, { useEffect, useState } from 'react';
import { useNexus } from '../context/NexusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Users, Shield, Zap, AlertTriangle, Clock } from 'lucide-react';
import StadiumMap from '../components/StadiumMap';
import ZoneDensityBars from '../components/ZoneDensityBars';
import ImpactChart from '../components/ImpactChart';
import ApprovalQueue from '../components/ApprovalQueue';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

const OpsDashboard = () => {
  const { stadium, densities, matchState, actions, loading } = useNexus();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => setUser(nextUser));
    return () => unsub();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-black">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-cyan-400 font-bold tracking-widest text-2xl"
      >
        INITIALIZING NEXUS...
      </motion.div>
    </div>
  );

  // Compute crowd pressure index (average of all zone densities)
  const avgDensity = Object.values(densities).length > 0
    ? Object.values(densities).reduce((sum, z) => sum + (z.pct || 0), 0) / Object.values(densities).length
    : 0;
  const pressureIndex = (avgDensity * 10).toFixed(1);

  // Latest AI risk assessment
  const latestRisk = actions.length > 0 ? actions[0]?.risk_assessment : null;

  // Prepare density values for StadiumMap (expects { zoneId: pct })
  const mapDensities = {};
  Object.entries(densities).forEach(([zoneId, data]) => {
    mapDensities[zoneId] = data.pct || 0;
  });

  const matchClock = formatMatchClock(matchState);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-cyan-400 font-bold tracking-tighter text-sm mb-1 uppercase">MA Chidambaram Stadium Operations</h2>
          <h1 className="text-5xl font-extrabold tracking-tighter italic">NEXUS CONTROL</h1>
        </div>
        <div className="text-right">
          <div className="mb-3 flex items-center justify-end gap-3">
            <div className="text-[10px] text-white/35 font-medium">
              {user?.email || 'Operator'}
            </div>
            <button
              onClick={() => signOut(auth)}
              className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20"
            >
              Sign out
            </button>
          </div>
          <div className="mb-3 flex items-center justify-end gap-2">
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300">
              {matchClock}
            </div>
            {typeof matchState?.mins_to_halftime === 'number' && matchState.mins_to_halftime >= 0 && matchState.mins_to_halftime <= 15 ? (
              <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                T-{matchState.mins_to_halftime} min
              </div>
            ) : null}
          </div>
          <div className="text-white/40 text-xs uppercase font-bold tracking-widest mb-1 italic">Match Status</div>
          <div className="flex gap-4 items-center">
            <div className="flex flex-col items-center px-4 py-2 glass-card">
              <span className="text-xs text-cyan-400 font-bold leading-none mb-1 uppercase">Over</span>
              <span className="text-2xl font-black italic">{matchState?.over || '—'}</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 glass-card">
              <span className="text-xs text-white/50 font-bold leading-none mb-1 uppercase">Score</span>
              <span className="text-2xl font-black italic">{matchState?.score || '—'}</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 glass-card">
              <span className="text-xs font-bold leading-none mb-1 uppercase" style={{ color: matchState?.mins_to_halftime <= 10 ? '#E24B4A' : '#EF9F27' }}>
                <Clock size={10} className="inline mr-1" />Halftime
              </span>
              <span className="text-2xl font-black italic">{matchState?.mins_to_halftime ?? '—'}m</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 glass-card">
              <span className="text-xs text-pink-500 font-bold leading-none mb-1 uppercase">Budget</span>
              <span className="text-2xl font-black italic">₹{(matchState?.remaining_budget || 0).toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center px-4 py-2 glass-card">
              <span className="text-xs font-bold leading-none mb-1 uppercase" style={{ color: pressureIndex > 7 ? '#E24B4A' : pressureIndex > 5 ? '#EF9F27' : '#639922' }}>
                Pressure
              </span>
              <span className="text-2xl font-black italic">{pressureIndex}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* ─── Left column: Zone Density + Risk Assessment ─── */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <section className="glass-card p-6 neon-shadow">
            <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={14} className="text-cyan-400" />
              Zone Density Metrics
            </h3>
            <ZoneDensityBars
              zones={stadium.zones}
              densities={densities}
              crushThreshold={stadium.crush_threshold}
            />
          </section>

          <section className="glass-card p-6">
            <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={14} className="text-cyan-400" />
              AI Risk Assessment
            </h3>
            {latestRisk ? (
              <div className="text-sm border-l-2 border-cyan-500/50 pl-4 py-1 italic text-white/80">
                "{latestRisk}"
              </div>
            ) : (
              <div className="text-xs text-white/30 italic">
                No risk assessment yet — system monitoring...
              </div>
            )}
            {actions.length > 0 && actions[0]?.confidence && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-white/30 uppercase font-bold">Confidence</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${(actions[0].confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-cyan-400 font-bold tabular-nums">
                  {(actions[0].confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </section>
        </div>

        {/* ─── Center: Live Map + Impact Chart ─── */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          {/* Stadium Map */}
          <div className="glass-card relative overflow-hidden" style={{ minHeight: '400px' }}>
            <div className="absolute top-4 left-4 z-10">
              <div className="flex gap-2">
                <span className="bg-cyan-500 text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-tighter rounded">Live Map</span>
                <span className="bg-white/10 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-tighter rounded backdrop-blur">Chepauk v2.1</span>
              </div>
            </div>
            <StadiumMap crowdDensity={mapDensities} />
          </div>

          {/* Impact Chart */}
          <div className="glass-card p-4">
            <ImpactChart />
          </div>
        </div>

        {/* ─── Right column: Action Feed + Approval Queue ─── */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* Human-in-the-loop Approval Queue */}
          <section className="glass-card">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                Pending Approvals
              </h3>
            </div>
            <div className="p-3">
              <ApprovalQueue stadiumId="chepauk" />
            </div>
          </section>

          {/* Response Feed */}
          <section className="glass-card flex flex-col" style={{ maxHeight: '500px' }}>
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" />
                Response Feed
              </h3>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-700" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {actions.length > 0 ? actions.map((action, idx) => (
                  <motion.div
                    key={action.id || idx}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="p-3 border-b border-white/5 last:border-0"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: getStakeholderColor(action.stakeholder) + '20',
                          color: getStakeholderColor(action.stakeholder)
                        }}
                      >
                        {action.stakeholder}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                          style={{
                            backgroundColor: action.priority >= 4 ? '#E24B4A20' : '#ffffff10',
                            color: action.priority >= 4 ? '#E24B4A' : '#ffffff60'
                          }}
                        >
                          {action.priority}
                        </span>
                        <span
                          className="text-[8px] font-bold uppercase px-1 py-0.5 rounded"
                          style={{
                            color: action.status === 'dispatched' || action.status === 'approved' ? '#639922'
                              : action.status === 'pending' ? '#EF9F27'
                              : action.status === 'rejected' ? '#E24B4A' : '#666'
                          }}
                        >
                          {action.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-white/90 leading-tight">
                      {action.action}
                    </p>
                    {action.timestamp && (
                      <span className="text-[9px] text-white/20 italic mt-1 block">
                        {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </motion.div>
                )) : (
                  <div className="p-8 text-center text-xs text-white/20 font-bold uppercase italic mt-10">
                    Standby For Nexus Decision...
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

function getStakeholderColor(stakeholder) {
  switch (stakeholder?.toLowerCase()) {
    case 'security': return '#E24B4A';
    case 'fans': return '#378ADD';
    case 'concessions': return '#EF9F27';
    case 'medical': return '#E24B4A';
    case 'transport': return '#639922';
    default: return '#888888';
  }
}

function formatMatchClock(matchState) {
  const minute = matchState?.match_minute;
  if (minute === null || minute === undefined) return 'Waiting for match clock';
  if (minute < 0) return `Pre-match · T-${Math.abs(minute)} min`;
  if (minute < 45) return `1st innings · Over ${Math.floor(minute / 3.75)}`;
  if (minute < 60) return 'Halftime';
  if (minute <= 110) return `2nd innings · Over ${Math.floor((minute - 60) / 2.5)}`;
  return 'Post-match';
}

export default OpsDashboard;
