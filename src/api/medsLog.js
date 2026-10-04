// src/api/medsLog.js — the Meds panel's Firestore reads and writes: users/{uid}/routine_log/{date}.
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { medsDoc } from "../lib/medsLog.js";

const ref = (userId, date) => doc(db, "users", userId, "routine_log", date);

/** The day's entries ({} when there are none). */
export async function loadMeds(userId, date) {
  const snap = await getDoc(ref(userId, date));
  return snap.exists() ? snap.data().entries || {} : {};
}

/** Merged, never replaced: the routine tasks live in the same document. Errors are logged. */
export async function saveMeds(userId, date, entries) {
  try {
    await setDoc(ref(userId, date), medsDoc(entries, date, new Date()), { merge: true });
  } catch (e) {
    console.error("Meds save error:", e);
  }
}
