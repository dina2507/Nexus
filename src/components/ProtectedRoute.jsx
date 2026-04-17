import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const provider = new GoogleAuthProvider();

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [roleChecking, setRoleChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) { setRole(null); return; }
    setRoleChecking(true);
    getDoc(doc(db, 'operators', user.uid))
      .then(snap => setRole(snap.exists() ? (snap.data().role || 'viewer') : 'pending'))
      .catch(() => setRole('pending'))
      .finally(() => setRoleChecking(false));
  }, [user]);

  async function handleSignIn() {
    setError('');
    try { await signInWithPopup(auth, provider); }
    catch (err) { setError(err?.message || 'Sign in failed'); }
  }

  if (loading || roleChecking) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="card" style={{ padding: '32px', textAlign: 'center', width: '100%', maxWidth: '360px' }}>
          <p className="section-label" style={{ margin: '0 0 16px' }}>
            {loading ? 'Verifying access' : 'Checking operator role'}
          </p>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            border: '2px solid rgba(59,130,246,0.2)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="card" style={{ padding: '32px', width: '100%', maxWidth: '380px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>NEXUS</span>
            <span className="badge badge-blue">Ops Access</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px' }}>
            Sign in to continue
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.55 }}>
            Operator access is restricted to authenticated Google accounts.
          </p>
          <button
            onClick={handleSignIn}
            style={{
              width: '100%', padding: '11px', borderRadius: '8px',
              background: 'white', color: '#111827', border: 'none',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'opacity 0.15s', fontFamily: 'Outfit, sans-serif',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            Sign in with Google
          </button>
          {error && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--danger)', textAlign: 'center' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (role === 'pending') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="card" style={{ padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <span className="badge badge-amber" style={{ marginBottom: '16px' }}>Access Pending</span>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 10px' }}>Awaiting approval</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 20px' }}>
            Your account ({user.email}) has not been granted operator access yet.
            Contact your stadium administrator.
          </p>
          <button className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
}
