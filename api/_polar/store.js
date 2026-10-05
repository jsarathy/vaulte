// api/_polar/store.js — the Polar connection and sessions under users/{uid} (Firebase Admin).
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

const connectionRef = (db, userId) => db.doc(`users/${userId}/polar/connection`);

/** The stored connection ({ access_token, polar_user_id, … }); null unless connected. */
export async function loadConnection(db, userId) {
  const doc = await connectionRef(db, userId).get();
  return doc.exists && doc.data().connected ? doc.data() : null;
}

/** Record that a sync ran now. */
export const stampSync = (db, userId) =>
  connectionRef(db, userId).update({ last_sync_at: new Date().toISOString() });

/** Save the sessions and stamp the sync in one batch. */
export function saveSessions(db, userId, sessions) {
  const batch = db.batch();
  for (const s of sessions) batch.set(db.doc(`users/${userId}/polar_sessions/${s.id}`), s);
  batch.update(connectionRef(db, userId), { last_sync_at: new Date().toISOString() });
  return batch.commit();
}
