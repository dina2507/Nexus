import { useState } from 'react';
import { Ticket, Check, AlertCircle, Loader2 } from 'lucide-react';
import { fetchWithAuth } from './auth';

const VoucherRedemption = () => {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleRedeem = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;

    setStatus('loading');
    setError('');
    
    try {
      const resp = await fetchWithAuth(`${import.meta.env.VITE_FUNCTIONS_URL}/redeemVoucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      
      const data = await resp.json();
      
      if (resp.ok) {
        setStatus('success');
        setResult(data);
        setToken('');
      } else {
        setStatus('error');
        setError(data.error || 'Redemption failed');
      }
    } catch (err) {
      setStatus('error');
      setError('Connection error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <form onSubmit={handleRedeem} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste voucher token..."
            style={{
              width: '100%',
              padding: '10px 12px',
              paddingLeft: '34px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />
          <Ticket size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
        
        <button 
          type="submit" 
          disabled={status === 'loading' || !token.trim()}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {status === 'loading' ? (
            <>
              <Loader2 size={14} className="spin" />
              Validating...
            </>
          ) : (
            'Redeem Voucher'
          )}
        </button>
      </form>

      {status === 'success' && (
        <div style={{ 
          padding: '10px', borderRadius: '8px', background: 'var(--success-dim)', 
          border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '10px' 
        }}>
          <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>Redeemed Successfully</div>
            <div style={{ fontSize: '10px', color: '#6ee7b7' }}>Value: ₹{result.inr} credited</div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ 
          padding: '10px', borderRadius: '8px', background: 'var(--danger-dim)', 
          border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '10px' 
        }}>
          <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#fca5a5' }}>{error}</div>
        </div>
      )}
    </div>
  );
};

export default VoucherRedemption;
