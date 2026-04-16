import React, { useState } from 'react';
import { Navigation } from 'lucide-react';
import { fetchWithAuth } from './auth';

export default function FanNavigateTab({ fanProfile, myZoneDensity, stadium }) {
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

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Navigation size={16} style={{ color: 'var(--accent)' }}/>
        <span className="section-label">Exit Route</span>
      </div>
      <div>
        <ol style={{ paddingLeft: '16px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
          <li>Exit your row and walk to the left.</li>
          <li>Take stairs B down to the main concourse.</li>
          <li>Exit via Gate {bestGate} (approx {waitTime} min wait).</li>
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
