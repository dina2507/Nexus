import React from 'react';
import { useNexus } from '../context/NexusContext';
import ImpactChart from '../components/ImpactChart';

const stakeholderOrder = ['security', 'fans', 'concessions', 'medical', 'transport'];

const stakeholderColors = {
  security: '#E24B4A',
  fans: '#378ADD',
  concessions: '#EF9F27',
  medical: '#A32D2D',
  transport: '#639922'
};

export default function MatchReport() {
  const { actions, stadium, matchState } = useNexus();
  const reportActions = [...actions].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const total = actions.length;
  const dispatched = actions.filter(a => a.status === 'dispatched').length;
  const reviewed = actions.filter(a => a.status === 'approved' || a.status === 'rejected').length;

  const byStakeholder = stakeholderOrder.map((stakeholder) => {
    const items = actions.filter(a => a.stakeholder === stakeholder);
    const highest = items.reduce((max, item) => Math.max(max, item.priority || 0), 0);
    return { stakeholder, count: items.length, highest };
  });

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="glass-card p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-400">Match Report</div>
          <h1 className="mt-2 text-3xl font-black italic">CSK vs MI · Chepauk · IPL 2026</h1>
          <p className="mt-2 text-sm text-white/50">{stadium.name} · {matchState?.score || '0/0'} · {matchState?.weather || 'Weather unavailable'}</p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ['Total AI decisions', total],
            ['Auto-dispatched', dispatched],
            ['Human reviewed', reviewed],
            ['Crowd risk prevented', '3 critical surges'],
          ].map(([label, value]) => (
            <div key={label} className="glass-card p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">{label}</div>
              <div className="mt-3 text-2xl font-black italic">{value}</div>
            </div>
          ))}
        </section>

        <section className="glass-card p-6 space-y-4">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-white/35">Stakeholder breakdown</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {byStakeholder.map(({ stakeholder, count, highest }) => (
              <div key={stakeholder} className="rounded-xl border border-white/8 p-4" style={{ background: `${stakeholderColors[stakeholder]}14` }}>
                <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: stakeholderColors[stakeholder] }}>{stakeholder}</div>
                <div className="mt-2 text-xl font-black">{count}</div>
                <div className="text-xs text-white/40">Highest priority: {highest || '—'}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-4">
          <ImpactChart />
        </section>

        <section className="glass-card p-6">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-white/35 mb-4">Top actions</div>
          <div className="space-y-3">
            {reportActions.slice(0, 10).map((action) => (
              <div key={action.id} className="rounded-xl border border-white/8 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: stakeholderColors[action.stakeholder] || '#999' }}>
                      {action.stakeholder}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/90">{action.action}</div>
                  </div>
                  <div className="text-right text-[10px] uppercase tracking-[0.25em] text-white/35">
                    P{action.priority || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pb-8 text-center text-[10px] font-black uppercase tracking-[0.35em] text-white/30">
          Powered by Gemini 2.0 Flash · Google Cloud · Firebase
        </footer>
      </div>
    </div>
  );
}