import { useState } from 'react';
import { Navigation } from 'lucide-react';
import { fetchWithAuth } from './auth';

export default function FanNavigateTab({ fanProfile, myZoneDensity, stadium, targetZone }) {
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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
            priority: 4
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
  
  if (targetZone && targetZone !== currentZoneId && stadium?.zones) {
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

  if (routeSteps.length === 0) {
    routeSteps = [
      `Exit your row and walk to the left.`,
      `Take stairs B down to the main concourse.`,
      `Exit via Gate ${bestGate} (approx ${waitTime} min wait).`
    ];
  }

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Navigation size={16} style={{ color: 'var(--accent)' }}/>
        <span className="section-label">
          {targetZone && targetZone !== currentZoneId ? 'Incentivized Safe Route' : 'Standard Exit Route'}
        </span>
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
