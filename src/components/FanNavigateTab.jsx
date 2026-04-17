import { useState, useEffect } from 'react';
import { Navigation } from 'lucide-react';
import { fetchWithAuth } from './auth';

export default function FanNavigateTab({ fanProfile, myZoneDensity, stadium, targetZone }) {
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (targetZone) setSuccessMsg('');
  }, [targetZone]);

  const handleGetMeOut = async () => {
    setOverrideLoading(true);
    setSuccessMsg('');
    try {
      await fetchWithAuth(`${import.meta.env.VITE_FUNCTIONS_URL}/nexusTrigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stadiumId: stadium?.id || 'chepauk',
          manualAction: {
            stakeholder: 'fans',
            action: `Push route update requested for ${fanProfile?.zone_id || 'unknown'}`,
            priority: 4,
            target_zone: fanProfile?.zone_id || 'north_stand'
          }
        })
      });
      setSuccessMsg('Request sent. Awaiting NEXUS redirect.');
    } catch (e) {
      console.error("Fast exit request failed", e);
    } finally {
      setOverrideLoading(false);
    }
  };

  const bestGate = fanProfile?.gate || 'G7';
  const waitTime = Math.max(1, Math.round(myZoneDensity * 8));

  // Dynamic Routing Logic
  let routeSteps = [];
  const currentZoneId = fanProfile?.zone_id;
  
  if (targetZone && stadium?.zones) {
    if (targetZone === currentZoneId) {
      // The fan is IN the target zone and needs to be redirected OUT of it
      const startZone = stadium.zones.find(z => z.id === currentZoneId);
      if (startZone && startZone.adjacent_zones?.length > 0) {
        const endZoneId = startZone.adjacent_zones[0];
        const endZone = stadium.zones.find(z => z.id === endZoneId);
        
        routeSteps = [
          `Exit your row and safely proceed to the nearest concourse.`,
          `Follow signs to the adjacent ${endZone?.label || 'safe area'}.`,
          `Proceed to the designated voucher area away from congestion.`
        ];
      }
    } else {
      // Target zone is a specific destination
      const startZone = stadium.zones.find(z => z.id === currentZoneId);
      const endZone = stadium.zones.find(z => z.id === targetZone);
      
      if (startZone && endZone) {
        // Check if directly adjacent based on adjacency map
        if (startZone.adjacent_zones?.includes(targetZone)) {
          routeSteps = [
            `Exit your row and safely proceed to the nearest concourse.`,
            `Follow signs to the adjacent ${endZone.label}.`,
            `Proceed to the designated voucher area in ${endZone.label}.`
          ];
        } else {
          // Assume indirect: go to concourse then to target
          routeSteps = [
            `Exit your row and move toward the main ring.`,
            `Take the connecting concourse toward ${endZone.label}.`,
            `Arrive at ${endZone.label} safely away from the congestion.`
          ];
        }
      }
    }
  }

  if (routeSteps.length === 0) {
    routeSteps = [
      `Exit your row and walk to the left.`,
      `Take stairs B down to the main concourse.`,
      `Exit via Gate ${bestGate} (approx ${waitTime} min wait).`
    ];
  }

  const densityColor = myZoneDensity >= 0.93 ? 'var(--danger)'
    : myZoneDensity >= 0.82 ? '#ef4444'
    : myZoneDensity >= 0.70 ? 'var(--warning)'
    : 'var(--success)';

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Navigation size={16} style={{ color: 'var(--accent)' }}/>
        <span className="section-label">
          {targetZone && targetZone !== currentZoneId ? 'Incentivized Safe Route' : 'Standard Exit Route'}
        </span>
      </div>

      {/* Zone status strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 700, color: densityColor,
          background: `${densityColor}18`, border: `1px solid ${densityColor}40`,
          borderRadius: '20px', padding: '3px 10px',
        }}>
          Your zone: {Math.round(myZoneDensity * 100)}%
        </div>
        <div style={{
          fontSize: '11px', color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '3px 10px',
        }}>
          ~{waitTime} min wait at gate {bestGate}
        </div>
      </div>
      <div>
        <ol style={{ paddingLeft: '16px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
          {routeSteps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>

      <div style={{ background: 'var(--border-subtle)', height: '1px' }} />

      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Experiencing heavy crowding?
        </p>
        <button className="btn-primary" 
          onClick={handleGetMeOut} 
          disabled={overrideLoading}
          style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
          {overrideLoading ? 'Requesting...' : 'Get me out fast'}
        </button>
        {successMsg && <p style={{ color: 'var(--success)', fontSize: '11px', marginTop: '8px', textAlign: 'center'}}>{successMsg}</p>}
      </div>
    </div>
  );
}
