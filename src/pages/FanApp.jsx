import { useEffect, useState } from 'react';
import { useNexus } from '../context/NexusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Activity, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWithAuth } from '../components/auth';
import FanNavigateTab from '../components/FanNavigateTab';
import FanLiveTab from '../components/FanLiveTab';
import FanSeatTab from '../components/FanSeatTab';
import { getToken, onMessage } from 'firebase/messaging';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  doc, setDoc,
  collection, query, where, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { auth, db, messaging } from '../firebase/config';

const STADIUM_ID = import.meta.env.VITE_STADIUM_ID || 'chepauk';

const DEFAULT_SEAT = {
  section: 'North Stand',
  tier: 'Upper Tier',
  seat: 'F-122',
  gate: 'G7',
  zone_id: 'north_stand',
};



const FanApp = () => {
  const { matchState, densities, actions, stadium } = useNexus();
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('navigate');
  const [fanProfile, setFanProfile] = useState(null);
  const [uid, setUid] = useState(null);
  const [activeTargetZone, setActiveTargetZone] = useState(null);

  // ── Auth + FCM bootstrap + profile load ──────────────────
  useEffect(() => {
    let unsubscribeMessage = null;
    let unsubscribeAuth = null;
    let unsubscribeProfile = null;

    async function bootstrap() {
      try { await signInAnonymously(auth); }
      catch (err) { console.warn('Anonymous sign-in unavailable:', err?.message || err); }

      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser) return;
        setUid(currentUser.uid);

        // Sub to profile with onSnapshot to make FanApp reactive to zone resets
        const ref = doc(db, 'fan_profiles', currentUser.uid);
        
        unsubscribeProfile = onSnapshot(ref, async (snap) => {
          if (snap.exists()) {
            setFanProfile({ ...DEFAULT_SEAT, ...snap.data() });
          } else {
            await setDoc(ref, {
              stadium_id: STADIUM_ID,
              ...DEFAULT_SEAT,
              created_at: new Date().toISOString(),
            }, { merge: true });
            // onSnapshot will fire again once setDoc completes
          }
        });

        if (!messaging) return;
        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission !== 'granted') return;

        try {
          const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY });
          if (token) {
            await setDoc(ref, {
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
            target_zone: payload.data?.target_zone || '',
            incentive_inr: Number(payload.data?.incentive_inr || 0),
            actionId: payload.data?.action_id || null,
          });
        });
      }
    }

    bootstrap();
    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // ── Subscribe ONLY to fan actions targeting this fan's zone ─
  useEffect(() => {
    if (!fanProfile?.zone_id) return undefined;
    const q = query(
      collection(db, 'nexus_actions'),
      where('stakeholder', '==', 'fans'),
      where('stadium_id', '==', STADIUM_ID),
      where('status', '==', 'dispatched'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const action = snap.docs[0].data();
      const actionId = snap.docs[0].id;
      // Only surface if the action targets this fan's zone OR is a global push
      if (action.target_zone && action.target_zone !== fanProfile.zone_id) return;
      setNotification({
        title: `NEXUS · ${action.target_zone?.replace(/_/g, ' ') || 'Stadium'}`,
        body: action.action,
        target_zone: action.target_zone || '',
        incentive_inr: action.incentive_inr || 0,
        actionId,
      });
    });
  }, [fanProfile?.zone_id, uid]);

  const [voucherPayload, setVoucherPayload] = useState(null);

  useEffect(() => {
    if (!notification || notification.incentive_inr <= 0 || !notification.actionId || !uid) {
      setVoucherPayload(null);
      return;
    }

    // Fetch server-signed voucher
    const fetchSignedVoucher = async () => {
      try {
        const resp = await fetchWithAuth(`${import.meta.env.VITE_FUNCTIONS_URL}/mintVoucher`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId: notification.actionId, uid }),
        });
        const data = await resp.json();
        if (data.token) {
          setVoucherPayload(data.token); // The JWT itself
        }
      } catch (err) {
        console.error('Failed to mint voucher:', err);
      }
    };

    fetchSignedVoucher();
  }, [notification, uid]);

  const myZoneDensity = fanProfile?.zone_id ? (densities[fanProfile.zone_id]?.pct || 0) : 0;

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
            {matchState?.home_team || 'CSK'}{' '}
            <span style={{ color: 'var(--accent)' }}>vs</span>{' '}
            {matchState?.away_team || 'MI'}
          </h1>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
            {matchState?.score || '—'}
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {stadium?.name || 'MA Chidambaram Stadium'} · IPL 2026
        </p>
      </header>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {activeTab === 'navigate' && (
          <FanNavigateTab 
            fanProfile={fanProfile} 
            myZoneDensity={myZoneDensity} 
            stadium={stadium} 
            densities={densities} 
            targetZone={activeTargetZone}
          />
        )}
        {activeTab === 'live' && (
          <FanLiveTab
            matchState={matchState}
            actions={actions}
            fanProfile={fanProfile}
            myZoneDensity={myZoneDensity}
          />
        )}
        {activeTab === 'ticket' && (
          <FanSeatTab 
            fanProfile={fanProfile} 
            uid={uid} 
          />
        )}

      </div>

      {/* Notification overlay — now includes the voucher QR */}
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
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
                background: 'var(--accent)',
              }} />

              <div style={{ padding: '14px 14px 14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
                      {notification.title}
                    </span>
                  </div>
                  <button
                    onClick={() => setNotification(null)}
                    aria-label="Dismiss notification"
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

                {/* Voucher QR — shown only when incentive is present */}
                {notification.incentive_inr > 0 && voucherPayload && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px', marginBottom: '12px',
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: '8px',
                  }}>
                    <QRCodeSVG
                      value={voucherPayload}
                      size={72}
                      bgColor="#ffffff"
                      fgColor="#0a0f1e"
                      level="M"
                      style={{ borderRadius: '6px', background: 'white', padding: '4px', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                        Voucher
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>
                        ₹{notification.incentive_inr}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Scan at any concession
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
                  onClick={() => {
                    setActiveTargetZone(notification.target_zone || null);
                    setActiveTab('navigate');
                    setNotification(null);
                  }}
                >
                  <Navigation size={14} />
                  Route me
                  {notification.incentive_inr > 0 && ` · Claim ₹${notification.incentive_inr}`}
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
        {tabs.map(({ id, label, Icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-label={`${label} tab`}
            aria-pressed={activeTab === id}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 20px',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'color 0.15s',
            }}
          >
            <TabIcon size={20} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default FanApp;
