// src/api/polarDetail.js — a logged Polar session (users/{uid}/polar_sessions/{id}), and its heart
// rate fetched from Polar afterwards (/api/polar-fetch-hr).
import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

/** The session, or null when it isn't stored. */
export async function loadPolarSession(userId, sessionId) {
  const snap = await getDoc(doc(db, "users", userId, "polar_sessions", sessionId));
  return snap.exists() ? snap.data() : null;
}

/** { ok, data } from the heart-rate endpoint; throws on a network failure. */
export async function fetchHeartRate(userId, sessionId) {
  const res = await fetch("/api/polar-fetch-hr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, sessionId }),
  });
  return { ok: res.ok, data: await res.json() };
}
