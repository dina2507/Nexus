import React, { useEffect, useState } from 'react';
import { useNexus } from '../context/NexusContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Ticket, Bell, Navigation, Activity } from 'lucide-react';
import { getToken, onMessage } from 'firebase/messaging';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, messaging } from '../firebase/config';

const FanApp = () => {
  const { matchState } = useNexus();
  const [notification, setNotification] = useState(null);
  const [liveNudge, setLiveNudge] = useState(null);

  useEffect(() => {
    let unsubscribeMessage = null;
    let unsubscribeAuth = null;

    async function bootstrapMessaging() {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn('Anonymous sign-in unavailable:', err?.message || err);
      }

      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        if (!currentUser || !messaging) return;

        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;

        if (permission !== 'granted') return;

        try {
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_VAPID_KEY
          });

          if (token) {
            await setDoc(doc(db, 'fan_profiles', currentUser.uid), {
              stadium_id: 'chepauk',
              fcm_token: token,
              updated_at: new Date().toISOString()
            }, { merge: true });
            console.log('FCM token registered:', token);
          }
        } catch (err) {
          console.warn('FCM token registration failed:', err?.message || err);
        }
      });

      if (messaging) {
        unsubscribeMessage = onMessage(messaging, (payload) => {
          setLiveNudge({
            title: payload.notification?.title || 'NEXUS Alert',
            body: payload.notification?.body || 'New fan nudge available',
            reward: payload.data?.incentive_inr ? `₹${payload.data.incentive_inr} VOUCHER` : 'VIEW NOW'
          });
        });
      }
    }

    bootstrapMessaging();

    const timer = setTimeout(() => {
      setNotification({
        title: 'HALFTIME REDIRECT',
        body: 'North Stand exit is congested. Use Gate G7 for 50% faster exit or visit Stand C for ₹80 off any beverage.',
        reward: '₹80 VOUCHER'
      });
    }, 5000);

    return () => {
      clearTimeout(timer);
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  const activeNotification = liveNudge || notification;

  return (
    <div className="max-w-[450px] mx-auto min-h-screen bg-[#050505] relative overflow-hidden flex flex-col">
      {/* Status Bar Pseudo */}
      <div className="h-10 px-6 flex justify-between items-end pb-3">
        <div className="text-[10px] font-black tracking-widest text-cyan-400">NEXUS CONNECT</div>
        <div className="h-1 w-12 bg-white/10 rounded-full" />
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 pt-4">
        <header className="mb-8">
          <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Current Match</div>
          <div className="flex justify-between items-baseline">
            <h1 className="text-3xl font-black italic">CSK <span className="text-cyan-400">vs</span> MI</h1>
            <span className="text-sm font-bold text-cyan-400">{matchState?.score || '122/4'}</span>
          </div>
        </header>

        <section className="space-y-4">
          <div className="glass-card p-5 relative overflow-hidden group border-cyan-500/20">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-cyan-400/10 rounded-lg">
                <Ticket className="text-cyan-400" size={20} />
              </div>
              <span className="text-[10px] font-black bg-white/5 px-2 py-1 rounded text-white/50">ENTRY: G7</span>
            </div>
            <h3 className="text-xl font-bold italic mb-1">Your Seat: F-122</h3>
            <p className="text-xs text-white/40 font-medium">North Stand Upper Tier</p>
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/5 rounded-full blur-2xl -mr-10 -mt-10" />
          </div>

          <div className="glass-card p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
              <MapPin size={12} className="text-pink-500" />
              Live Wait Times
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-white/30 uppercase">Gate G7</div>
                <div className="text-lg font-black italic">4 MIN</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-white/30 uppercase">Concessions</div>
                <div className="text-lg font-black italic text-cyan-400">2 MIN</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Notification Overlay */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="absolute bottom-24 left-4 right-4 z-50"
          >
            <div className="glass-card p-6 border-cyan-400 shadow-[0_20px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
               <button 
                onClick={() => setNotification(null)}
                className="absolute top-2 right-2 text-white/20 hover:text-white"
               >
                 ✕
               </button>
               <div className="flex items-center gap-3 mb-3">
                 <Bell className="text-cyan-400" size={18} />
                 <span className="text-[10px] font-black tracking-widest text-cyan-400">{activeNotification.title}</span>
               </div>
               <p className="text-sm font-medium leading-relaxed mb-4">
                 {activeNotification.body}
               </p>
               <button className="w-full bg-cyan-400 text-black font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-transform uppercase italic tracking-tighter">
                 <Navigation size={14} />
                 Route Me & Claim {activeNotification.reward}
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav Pseudo */}
      <div className="h-20 glass border-t border-white/5 px-8 flex justify-between items-center bg-black/80 backdrop-blur-xl">
        <Navigation className="text-cyan-400" size={24} />
        <Activity className="text-white/20" size={24} />
        <Ticket className="text-white/20" size={24} />
      </div>
    </div>
  );
};

export default FanApp;
