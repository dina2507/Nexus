import { collection, doc, onSnapshot, query,
         orderBy, limit, where, updateDoc } from 'firebase/firestore';
import { db } from './config';

// ── Collection References ──────────────────────────────────
export const STADIUMS_COL = collection(db, 'stadiums');
export const CROWD_DENSITY_COL = collection(db, 'crowd_density');
export const NEXUS_ACTIONS_COL = collection(db, 'nexus_actions');
export const MATCH_EVENTS_COL = collection(db, 'match_events');
export const FAN_PROFILES_COL = collection(db, 'fan_profiles');

// Document constants
export const CURRENT_MATCH_DOC = 'current';
export const CHEPAUK_STADIUM_ID = 'chepauk';

// ── Real-time Subscriptions ────────────────────────────────

/**
 * Subscribe to real-time crowd density for all zones in a stadium.
 * Returns unsubscribe function.
 */
export function subscribeCrowdDensity(stadiumId, callback) {
  const q = query(
    collection(db, 'crowd_density'),
    where('stadium_id', '==', stadiumId)
  );
  return onSnapshot(q, snap => {
    const data = {};
    snap.forEach(doc => data[doc.id] = doc.data());
    callback(data);
  });
}

/**
 * Subscribe to real-time action feed (last 20 actions).
 * Returns unsubscribe function.
 */
export function subscribeActions(stadiumId, callback) {
  const q = query(
    collection(db, 'nexus_actions'),
    where('stadium_id', '==', stadiumId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Approve or reject a pending action (human-in-the-loop).
 */
export async function resolveAction(actionId, decision, operatorUid = 'system') {
  await updateDoc(doc(db, 'nexus_actions', actionId), {
    status: decision, // 'approved' or 'rejected'
    resolved_at: new Date().toISOString(),
    operator_uid: operatorUid
  });
}

/**
 * Subscribe to real-time pending actions for human review.
 * Returns unsubscribe function.
 */
export function subscribePendingActions(stadiumId, callback) {
  const q = query(
    collection(db, 'nexus_actions'),
    where('stadium_id', '==', stadiumId),
    where('status', '==', 'pending'),
    orderBy('timestamp', 'desc'),
    limit(5)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
