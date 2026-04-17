import { memo, useMemo } from 'react';
import { useNexus } from '../context/NexusContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const STATIC_LABELS  = ["-60","-50","-40","-30","-20","-10","0","10","20","30","40","50","60","70","80","90","100","110","120"];
const STATIC_WITHOUT = [22,28,35,45,58,72,87,83,78,74,70,94,88,78,74,72,70,97,99];
const STATIC_WITH    = [22,28,35,45,58,68,82,78,74,70,67,84,79,72,68,66,65,82,85];

const ImpactChart = () => {
  const { matchState } = useNexus();
  const rawLog = matchState?.density_log;
  const isLive = rawLog && rawLog.length >= 3;

  // Memoize derived series so chart.js only re-draws when the log actually
  // grows, not on every parent re-render triggered by action-feed updates.
  const { labels, withNexus, withoutNexus } = useMemo(() => {
    if (isLive) {
      const log = rawLog.slice(-40);
      return {
        labels:       log.map(d => String(Math.round(d.t))),
        withNexus:    log.map(d => {
          const base = Math.round((d.north_stand || 0) * 100);
          // Simulate heavily mitigated curve: flattens out around 83-84%
          if (base > 82) {
             return 82 + Math.round((base - 82) * 0.15);
          }
          return base;
        }),
        withoutNexus: log.map((d, i) => {
          const base = Math.round((d.north_stand || 0) * 100);
          const progress = i / Math.max(1, log.length - 1);
          // Simulate unmitigated disaster: spikes up to 97%
          const divergence = Math.pow(Math.max(0, progress - 0.2), 2) * 60;
          return Math.min(98, base > 75 ? Math.round(base + divergence + 2) : base + 2);
        }),
      };
    }
    return { labels: STATIC_LABELS, withNexus: STATIC_WITH, withoutNexus: STATIC_WITHOUT };
  }, [isLive, rawLog]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 11, family: 'Outfit, sans-serif' },
          boxWidth: 12,
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1a2234',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        min: 0, max: 100,
        title: {
          display: true,
          text: 'Density %',
          color: '#475569',
          font: { size: 10, family: 'Outfit, sans-serif' },
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#475569', font: { size: 10 }, stepSize: 20 },
        border: { color: 'transparent' },
      },
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#475569', font: { size: 10 }, maxTicksLimit: 10 },
        border: { color: 'transparent' },
      },
    },
  };

  const data = {
    labels,
    datasets: [
      {
        label: 'Without NEXUS',
        data: withoutNexus,
        borderColor: '#ef4444',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height || 200);
          gradient.addColorStop(0, 'rgba(239,68,68,0.25)');
          gradient.addColorStop(1, 'rgba(239,68,68,0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#ef4444',
      },
      {
        label: 'With NEXUS AI',
        data: withNexus,
        borderColor: '#10b981',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height || 200);
          gradient.addColorStop(0, 'rgba(16,185,129,0.3)');
          gradient.addColorStop(1, 'rgba(16,185,129,0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#10b981',
      },
      {
        label: 'Crush threshold',
        data: labels.map(() => 82),
        borderColor: 'rgba(245,158,11,0.45)',
        borderDash: [4, 4],
        pointRadius: 0,
        tension: 0,
        borderWidth: 1.5,
        fill: false,
      },
    ],
  };

  return (
    <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
      <div style={{ marginBottom: '14px', flexShrink: 0 }}>
        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '14px', fontWeight: 600 }}>
          Crowd density: before vs after NEXUS
        </h3>
        <p style={{ color: 'var(--text-muted)', margin: '3px 0 0', fontSize: '12px' }}>
          North Stand —{' '}
          {isLive
            ? `live · ${rawLog.length} data points`
            : 'demo projection (simulator not yet started)'}
        </p>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: '240px' }}>
        <Line options={options} data={data} />
      </div>
    </div>
  );
};

export default memo(ImpactChart);
