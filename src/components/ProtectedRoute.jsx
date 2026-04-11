import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/config';

const provider = new GoogleAuthProvider();

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  async function handleSignIn() {
    setError('');
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err?.message || 'Sign in failed');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="glass-card w-full max-w-md p-8 text-center">
          <div className="text-cyan-400 text-sm font-bold tracking-[0.3em] uppercase">Loading access</div>
          <div className="mt-4 h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (user) return children;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8 text-center" style={{ background: '#1a1a2e' }}>
        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-400">NEXUS ACCESS</div>
        <h1 className="mt-3 text-3xl font-black italic">Sign in to continue</h1>
        <p className="mt-3 text-sm text-white/60">
          Operator access is restricted to authenticated Google accounts.
        </p>
        <button
          onClick={handleSignIn}
          className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          Sign in with Google
        </button>
        {error ? <p className="mt-4 text-xs text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}