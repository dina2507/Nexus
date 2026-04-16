import React, { useState } from 'react';
import { Ticket, User, Save } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function FanSeatTab({ fanProfile, uid }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Editable fields 
  const [zoneId, setZoneId] = useState(fanProfile?.zone_id || 'north_stand');

  const handleUpdate = async () => {
    if (!uid) return;
    setLoading(true);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'fan_profiles', uid), {
        zone_id: zoneId,
        updated_at: new Date().toISOString()
      }, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to update profile", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ padding: '8px', background: 'var(--accent-dim)', borderRadius: '8px', display: 'flex' }}>
            <Ticket style={{ color: 'var(--accent)' }} size={18} />
          </div>
          <span className="badge badge-slate">Entry: {fanProfile?.gate || '—'}</span>
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
          Seat {fanProfile?.seat || '—'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          {fanProfile?.section || '—'} · {fanProfile?.tier || '—'}
        </p>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <User size={16} style={{ color: 'var(--accent)' }}/>
          <span className="section-label">Demographics & Demo Profile</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Simulated Zone
            </label>
            <select 
              value={zoneId} 
              onChange={e => setZoneId(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px',
                background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
              }}
            >
              <option value="north_stand">North Stand</option>
              <option value="south_stand">South Stand</option>
              <option value="east_block">East Block</option>
              <option value="west_block">West Block</option>
              <option value="concourse_a">Main Concourse (A)</option>
              <option value="concourse_b">Outer Concourse (B)</option>
            </select>
          </div>

          <button className="btn-primary" 
            onClick={handleUpdate} 
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: '4px' }}>
            <Save size={14} />
            {loading ? 'Saving...' : 'Update Profile'}
          </button>
          
          {success && <p style={{ color: 'var(--success)', fontSize: '11px', textAlign: 'center', margin: 0 }}>Profile updated successfully!</p>}
        </div>
      </div>
    </div>
  );
}
