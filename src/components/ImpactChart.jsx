import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ImpactChart = () => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e2e8f0' }
      },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Zone density %',
          color: '#94a3b8'
        },
        grid: { color: '#334155' },
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { color: '#334155' },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  const labels = ["-60","-50","-40","-30","-20","-10","0","10","20","30","40","50","60","70","80","90","100","110","120"];

  const data = {
    labels,
    datasets: [
      {
        label: 'Without NEXUS',
        data: [22,28,35,45,58,72,87,83,78,74,70,94,88,78,74,72,70,97,99],
        borderColor: '#E24B4A',
        backgroundColor: '#E24B4A',
        tension: 0.4,
      },
      {
        label: 'With NEXUS AI',
        data: [22,28,35,45,58,68,82,78,74,70,67,84,79,72,68,66,65,82,85],
        borderColor: '#639922',
        backgroundColor: '#639922',
        tension: 0.4,
      },
      {
        label: 'Crush threshold',
        data: labels.map(() => 82),
        borderColor: '#EF9F27',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
      }
    ]
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '16px' }}>Crowd density: before vs after NEXUS</h3>
        <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '13px' }}>North Stand — full match timeline</p>
      </div>
      <div style={{ height: '220px', position: 'relative' }}>
        <Line options={options} data={data} />
      </div>
    </div>
  );
};

export default ImpactChart;
