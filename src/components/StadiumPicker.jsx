import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNexus } from '../context/NexusContext';

export default function StadiumPicker() {
  const { activeStadiumId, setStadiumId } = useNexus();
  const [stadiums, setStadiums] = useState([]);

  useEffect(() => {
    // ProtectedRoute implies user is authenticated.
    const q = query(collection(db, 'stadiums'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, name: doc.data().name || doc.id });
      });
      setStadiums(list);
    }, (err) => console.error("StadiumPicker listener error:", err));

    return () => unsub();
  }, []);

  if (stadiums.length === 0) {
    return <span style={{ opacity: 0.6 }}>Loading stadiums...</span>;
  }

  return (
    <select
      value={activeStadiumId}
      onChange={(e) => setStadiumId(e.target.value)}
      style={{
        background: 'transparent',
        color: 'var(--text-muted)',
        border: 'none',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        cursor: 'pointer',
        outline: 'none',
        padding: '0',
        appearance: 'none', // minimal styling to fit the header
        fontWeight: 'inherit',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted'
      }}
    >
      {stadiums.map(s => (
        <option key={s.id} value={s.id} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
