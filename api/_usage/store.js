// api/_usage/store.js — where the call records go (Fix 41): users/{uid}/ai_usage, one document per
// call; a call with no readable user id goes to ai_usage_unattributed. Firebase Admin.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export const saveUsage = (userId, record) =>
  getAdminDb()
    .collection(userId ? `users/${userId}/ai_usage` : "ai_usage_unattributed")
    .add(userId ? record : { ...record, user_id: null });
