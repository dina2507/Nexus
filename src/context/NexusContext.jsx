import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import chepaukConfig from '../data/chepauk.json';

const STADIUM_ID = import.meta.env.VITE_STADIUM_ID || 'chepauk';

const NexusContext = createContext();

export const useNexus = () => useContext(NexusContext);

export const NexusProvider = ({ children }) => {
  const [stadium, setStadium] = useState(chepaukConfig);
  const [densities, setDensities] = useState({});
  const [matchState, setMatchState] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to stadium config from Firestore (falls back to static JSON while loading)
    const stadiumUnsub = onSnapshot(doc(db, 'stadiums', STADIUM_ID), (snap) => {
      if (snap.exists()) setStadium(snap.data());
    });

    // Listen to match state
    const matchUnsub = onSnapshot(doc(db, 'match_events', 'current'), (doc) => {
      if (doc.exists()) setMatchState(doc.data());
    });

    // Listen to crowd densities filtered by stadium
    const densityQ = query(collection(db, 'crowd_density'), where('stadium_id', '==', STADIUM_ID));
    const densityUnsub = onSnapshot(densityQ, (snapshot) => {
      const densityMap = {};
      snapshot.forEach(doc => {
        densityMap[doc.id] = doc.data();
      });
      setDensities(densityMap);
      setLoading(false);
    });

    // Listen to nexus actions filtered by stadium
    const actionsQ = query(
      collection(db, 'nexus_actions'),
      where('stadium_id', '==', STADIUM_ID),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const actionsUnsub = onSnapshot(actionsQ, (snapshot) => {
      const actionsList = [];
      snapshot.forEach(doc => {
        actionsList.push({ id: doc.id, ...doc.data() });
      });
      setActions(actionsList);
    });

    return () => {
      stadiumUnsub();
      matchUnsub();
      densityUnsub();
      actionsUnsub();
    };
  }, []);

  const value = {
    stadium,
    densities,
    matchState,
    actions,
    loading
  };

  return (
    <NexusContext.Provider value={value}>
      {children}
    </NexusContext.Provider>
  );
};
