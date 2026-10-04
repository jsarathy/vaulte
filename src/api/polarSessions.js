// src/api/polarSessions.js — Polar sessions in Firestore, and the Polar sign-in redirect.
import { getDocs, collection, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

/** All of the user's synced sessions, newest first. */
export async function loadPolarSessions(userId) {
  const q = query(collection(db, "users", userId, "polar_sessions"), orderBy("start_time", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Sends the browser to Polar's sign-in (the server redirects back). */
export function connectPolar(userId) {
  if (!userId) {
    alert("Not logged in — please refresh and try again.");
    return;
  }
  window.location.href = `/api/polar-auth?userId=${userId}`;
}
