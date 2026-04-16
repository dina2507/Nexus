import React from 'react';
import { useNexus } from '../context/NexusContext';
import { Activity } from 'lucide-react';

export default function GateActivityPanel() {
  const { gateData } = useNexus();

  const gates = Object.entries(gateData).sort((a, b) => a[0].localeCompare(b[0]));

  if (gates.length === 0) return null;

  return (
    <section className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
        <Activity size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
        <span className="section-label">Gate Activity (Scans/min)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {gates.map(([gateId, data]) => {
          const rate = data.scan_rate_per_min || 0;
          const maxRate = 30; // Arbitrary max for bar scale
          const pct = Math.min(100, (rate / maxRate) * 100);
          
          return (
            <div key={gateId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, width: '22px' }}>{gateId}</span>
              <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', width: `${pct}%`, 
                  background: pct > 85 ? 'var(--danger)' : pct > 60 ? 'var(--warning)' : 'var(--success)', 
                  borderRadius: '99px', transition: 'width 0.4s ease' 
                }} />
              </div>
              <span style={{ fontSize: '11px', width: '24px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {rate}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
