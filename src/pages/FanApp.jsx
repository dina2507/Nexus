import React, { useEffect, useState } from 'react';
import { useNexus } from '../context/NexusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Ticket, Bell, Navigation, Activity } from 'lucide-react';
import { getToken, onMessage } from 'firebase/messaging';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db, messaging } from '../firebase/config';

const FanApp = () => {
  const { matchState } = useNexus();
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('navigate');

  useEffect(() => {
    let unsubscribeMessage = null;
    let unsubscribeAuth = null;

    async function bootstrapMessaging() {
      try { await signInAnonymously(auth); }
      catch (err) { console.warn('Anonymous sign-in unavailable:', err?.message || err); }

      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser || !messaging) return;

        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;

        if (permission !== 'granted') return;

        try {
          const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY });
          if (token) {
            await setDoc(doc(db, 'fan_profiles', currentUser.uid), {
              stadium_id: import.meta.env.VITE_STADIUM_ID || 'chepauk',
              fcm_token: token,
              updated_at: new Date().toISOString(),
            }, { merge: true });
          }
        } catch (err) {
          console.warn('FCM token registration failed:', err?.message || err);
        }
      });

      if (messaging) {
        unsubscribeMessage = onMessage(messaging, (payload) => {
          setNotification({
            title: payload.notification?.title || 'NEXUS Alert',
            body: payload.notification?.body || 'New fan nudge available',
            reward: payload.data?.incentive_inr ? `₹${payload.data.incentive_inr} voucher` : 'View now',
          });
        });
      }
    }

    bootstrapMessaging();
    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'nexus_actions'),
      where('stakeholder', '==', 'fans'),
      where('status', '==', 'dispatched'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const action = snap.docs[0].data();
        setNotification({
          title: `NEXUS · ${action.target_zone?.replace(/_/g, ' ') || 'Stadium'}`,
          body: action.action,
          reward: action.incentive_inr ? `₹${action.incentive_inr} voucher` : 'View now',
        });
      }
    });
  }, []);

  const tabs = [
    { id: 'navigate', label: 'Navigate', Icon: Navigation },
    { id: 'live',     label: 'Live',     Icon: Activity  },
    { id: 'ticket',   label: 'My Seat',  Icon: Ticket    },
  ];

  return (
    <div style={{
      maxWidth: '450px', margin: '0 auto', minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Header */}
      <header style={{ padding: '24px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            NEXUS Connect
          </span>
          <span className="badge badge-green">
            <span className="status-dot live" /> Live
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            CSK <span style={{ color: 'var(--accent)' }}>vs</span> MI
          </h1>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
            {matchState?.score || '122/4'}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          MA Chidambaram Stadium · IPL 2026
        </p>
      </header>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Seat card */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{
              padding: '8px', background: 'var(--accent-dim)',
              borderRadius: '8px', display: 'flex',
            }}>
              <Ticket style={{ color: 'var(--accent)' }} size={18} />
            </div>
            <span className="badge badge-slate">Entry: G7</span>
          </div>
          <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
            Seat F-122
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            North Stand · Upper Tier
          </p>
        </div>

        {/* Wait times card */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            <MapPin size={12} style={{ color: 'var(--accent)' }} />
            <span className="section-label">Live Wait Times</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 3px',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Gate G7
              </p>
              <p style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
                4 <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>min</span>
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 3px',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Concessions
              </p>
              <p style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: 'var(--success)' }}>
                2 <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>min</span>
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Notification overlay */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={{
              position: 'absolute', bottom: '88px', left: '12px', right: '12px', zIndex: 50,
            }}
          >
            <div className="card" style={{
              borderColor: 'rgba(59,130,246,0.3)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Blue left accent stripe */}
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
                background: 'var(--accent)',
              }} />

              <div style={{ padding: '14px 14px 14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Bell size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
                      {notification.title}
                    </span>
                  </div>
                  <button
                    onClick={() => setNotification(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', padding: '2px', lineHeight: 1, fontSize: '14px' }}
                  >
                    ✕
                  </button>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5,
                  margin: '0 0 12px' }}>
                  {notification.body}
                </p>

                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
                >
                  <Navigation size={14} />
                  Route me · Claim {notification.reward}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <nav style={{
        height: '72px',
        background: 'rgba(17,24,39,0.96)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 8px', flexShrink: 0,
      }}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 20px',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default FanApp;
