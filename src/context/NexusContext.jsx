import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import chepaukConfig from '../data/chepauk.json';

const DEFAULT_STADIUM_ID = import.meta.env.VITE_STADIUM_ID || 'chepauk';

const NexusContext = createContext();

export const useNexus = () => useContext(NexusContext);

export const NexusProvider = ({ children }) => {
  const [activeStadiumId, setActiveStadiumId] = useState(() => {
    return localStorage.getItem('nexus.activeStadium') || DEFAULT_STADIUM_ID;
  });

  const [stadium, setStadium] = useState(chepaukConfig);
  const [densities, setDensities] = useState({});
  const [matchState, setMatchState] = useState(null);
  const [actions, setActions] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [gateData, setGateData] = useState({});
  const [loading, setLoading] = useState(true);

  // Expose a setter that updates state and localStorage
  const setStadiumId = (id) => {
    localStorage.setItem('nexus.activeStadium', id);
    setActiveStadiumId(id);
    setLoading(true);
  };

  useEffect(() => {
    let unsubs = [];

    const authUnsub = onAuthStateChanged(auth, (user) => {
      // Clear previous listeners
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      if (!user) {
        setLoading(true);
        return; // wait for login
      }

      // 1. Listen to stadium config
      unsubs.push(onSnapshot(doc(db, 'stadiums', activeStadiumId), (snap) => {
        if (snap.exists()) setStadium(snap.data());
      }));

      // 2. Listen to match state
      unsubs.push(onSnapshot(doc(db, 'match_events', 'current'), (doc) => {
        if (doc.exists()) setMatchState(doc.data());
      }));

      // 3. Listen to crowd densities
      const densityQ = query(collection(db, 'crowd_density'), where('stadium_id', '==', activeStadiumId));
      unsubs.push(onSnapshot(densityQ, (snapshot) => {
        const densityMap = {};
        snapshot.forEach(doc => { densityMap[doc.id] = doc.data(); });
        setDensities(densityMap);
        setLoading(false);
      }, (err) => console.error("Density listener error:", err)));

      // 4. Listen to nexus actions
      const actionsQ = query(
        collection(db, 'nexus_actions'),
        where('stadium_id', '==', activeStadiumId),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      unsubs.push(onSnapshot(actionsQ, (snapshot) => {
        const actionsList = [];
        snapshot.forEach(doc => { actionsList.push({ id: doc.id, ...doc.data() }); });
        setActions(actionsList);
      }));

      // 5. Listen to weather
      unsubs.push(onSnapshot(doc(db, 'weather', activeStadiumId), (doc) => {
        if (doc.exists()) setWeatherData(doc.data());
      }));

      // 6. Listen to gates
      const gatesQ = query(collection(db, 'gates'), where('stadium_id', '==', activeStadiumId));
      unsubs.push(onSnapshot(gatesQ, (snapshot) => {
        const gMap = {};
        snapshot.forEach(doc => { gMap[doc.id] = doc.data(); });
        setGateData(gMap);
      }));
    });

    return () => {
      authUnsub();
      unsubs.forEach(unsub => unsub());
    };
  }, [activeStadiumId]);

  const value = {
    activeStadiumId,
    setStadiumId,
    stadium,
    densities,
    matchState,
    actions,
    weatherData,
    gateData,
    loading
  };

  return (
    <NexusContext.Provider value={value}>
      {children}
    </NexusContext.Provider>
  );
};
