import React from 'react';
import { motion } from 'framer-motion';

/**
 * ZoneDensityBars — Animated density bars for each stadium zone.
 * Props:
 *   zones: array of zone objects from chepauk.json
 *   densities: { zoneId: { pct: 0.87, ... } }
 *   crushThreshold: number (e.g. 0.82)
 */
const ZoneDensityBars = ({ zones = [], densities = {}, crushThreshold = 0.82 }) => {
  return (
    <div className="space-y-4">
      {zones.map(zone => {
        const density = densities[zone.id]?.pct || 0;
        const isCritical = density >= crushThreshold;
        const isEmergency = density >= 0.93;
        const percentage = (density * 100).toFixed(1);

        return (
          <div key={zone.id} className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs font-bold uppercase tracking-tighter">
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{
                    backgroundColor: isEmergency ? '#A32D2D' : isCritical ? '#E24B4A' : density >= 0.70 ? '#EF9F27' : '#639922',
                    boxShadow: isEmergency ? '0 0 8px #A32D2D' : isCritical ? '0 0 8px #E24B4A' : 'none'
                  }}
                />
                {zone.label || zone.id.replace('_', ' ')}
              </span>
              <span
                className="tabular-nums"
                style={{
                  color: isEmergency ? '#A32D2D' : isCritical ? '#E24B4A' : density >= 0.70 ? '#EF9F27' : 'var(--neon-cyan, #00f3ff)'
                }}
              >
                {percentage}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
              {/* Crush threshold marker */}
              <div
                className="absolute top-0 h-full w-px bg-white/30 z-10"
                style={{ left: `${crushThreshold * 100}%` }}
                title={`Crush threshold: ${(crushThreshold * 100).toFixed(0)}%`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(density * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  background: isEmergency
                    ? 'linear-gradient(90deg, #E24B4A, #A32D2D)'
                    : isCritical
                      ? 'linear-gradient(90deg, #EF9F27, #E24B4A)'
                      : density >= 0.70
                        ? 'linear-gradient(90deg, #639922, #EF9F27)'
                        : 'linear-gradient(90deg, #00f3ff, #639922)',
                  boxShadow: isEmergency
                    ? '0 0 12px rgba(163, 45, 45, 0.8)'
                    : isCritical
                      ? '0 0 10px rgba(226, 75, 74, 0.6)'
                      : '0 0 8px rgba(0, 243, 255, 0.3)'
                }}
              />
            </div>
            {/* Zone details row */}
            <div className="flex justify-between text-[10px] text-white/30 font-medium">
              <span>Gates: {zone.gates?.join(', ') || '—'}</span>
              <span>{zone.throughput_per_min || 0}/min throughput</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ZoneDensityBars;
