// src/api/dashboard.js — what the Dashboard reads (Fix 98): when each app last gave the signed-in
// user data. Only the time fields are picked (never the Polar token). One failing read does not stop
// the others: it comes back as { failed: true }.
import { db } from "../firebase";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";

const FAILED = { failed: true };
const safe = (promise) => promise.catch(() => FAILED);

const polarOf = async (userId) => {
  const snap = await getDoc(doc(db, "users", userId, "polar", "connection"));
  if (!snap.exists()) return null;
  const { connected, last_sync_at } = snap.data();
  return { connected: connected === true, last_sync_at: last_sync_at || null };
};

/** The newest record of a collection by `field`, with just that field and the date, or null. */
const newest = async (userId, name, field) => {
  const col = collection(db, "users", userId, name);
  const snap = await getDocs(query(col, orderBy(field, "desc"), limit(1)));
  const data = snap.docs[0]?.data();
  return data ? { [field]: data[field] } : null;
};

export async function loadDashboard(userId) {
  const [polar, apple, weight, body] = await Promise.all([
    safe(polarOf(userId)),
    safe(newest(userId, "apple_activity", "updated_at")),
    safe(newest(userId, "weight_log", "date")),
    safe(newest(userId, "body_log", "date")),
  ]);
  return { polar, apple, weight, body };
}
