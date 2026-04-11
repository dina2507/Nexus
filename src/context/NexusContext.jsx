import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import chepaukConfig from '../data/chepauk.json';

const NexusContext = createContext();

export const useNexus = () => useContext(NexusContext);

export const NexusProvider = ({ children }) => {
  const [stadium, setStadium] = useState(chepaukConfig);
  const [densities, setDensities] = useState({});
  const [matchState, setMatchState] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to match state
    const matchUnsub = onSnapshot(doc(db, 'match_events', 'current'), (doc) => {
      if (doc.exists()) setMatchState(doc.data());
    });

    // Listen to crowd densities
    const densityUnsub = onSnapshot(collection(db, 'crowd_density'), (snapshot) => {
      const densityMap = {};
      snapshot.forEach(doc => {
        densityMap[doc.id] = doc.data();
      });
      setDensities(densityMap);
      setLoading(false);
    });

    // Listen to nexus actions
    const q = query(collection(db, 'nexus_actions'), orderBy('timestamp', 'desc'), limit(20));
    const actionsUnsub = onSnapshot(q, (snapshot) => {
      const actionsList = [];
      snapshot.forEach(doc => {
        actionsList.push({ id: doc.id, ...doc.data() });
      });
      setActions(actionsList);
    });

    return () => {
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
