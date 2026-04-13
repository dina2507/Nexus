import React from 'react';
import { motion } from 'framer-motion';

const ZoneDensityBars = ({ zones = [], densities = {}, crushThreshold = 0.82 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {zones.map(zone => {
        const density = densities[zone.id]?.pct || 0;
        const isCritical  = density >= crushThreshold;
        const isEmergency = density >= 0.93;
        const percentage  = (density * 100).toFixed(0);

        const color = isEmergency ? 'var(--danger-deep)'
                    : isCritical  ? 'var(--danger)'
                    : density >= 0.70 ? 'var(--warning)'
                    : 'var(--success)';

        const dotClass = isEmergency || isCritical ? 'danger'
                       : density >= 0.70 ? 'warning' : 'live';

        const barGradient = isEmergency
          ? 'linear-gradient(90deg, #ef4444, #dc2626)'
          : isCritical
            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
            : density >= 0.70
              ? 'linear-gradient(90deg, #10b981, #f59e0b)'
              : 'linear-gradient(90deg, #10b981, #34d399)';

        return (
          <div key={zone.id}>
            {/* Label row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`status-dot ${dotClass}`} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {zone.label || zone.id.replace(/_/g, ' ')}
                </span>
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                {percentage}%
              </span>
            </div>

            {/* Bar track */}
            <div className="density-track">
              {/* Crush threshold marker */}
              <div
                title={`Crush threshold: ${(crushThreshold * 100).toFixed(0)}%`}
                style={{
                  position: 'absolute', top: '-3px', bottom: '-3px', width: '2px',
                  background: 'rgba(245,158,11,0.45)', borderRadius: '1px',
                  left: `${crushThreshold * 100}%`, zIndex: 1,
                }}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(density * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                  height: '100%', borderRadius: '99px',
                  background: barGradient,
                }}
              />
            </div>

            {/* Gate / throughput row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px',
            }}>
              <span>Gates: {zone.gates?.join(', ') || '—'}</span>
              <span>{zone.throughput_per_min || 0}/min</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ZoneDensityBars;
