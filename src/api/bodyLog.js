// src/api/bodyLog.js — the Body tab's log in Firestore (users/{uid}/body_log/{date}) and the
// Renpho tape-measure sync.
import { db } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

const rowDoc = (userId, date) => doc(db, "users", userId, "body_log", date);

/** Save a row (replaces that date's document). */
export const saveBodyRow = (userId, row) => setDoc(rowDoc(userId, row.date), row);

/** Delete a date's row. */
export const deleteBodyRow = (userId, date) => deleteDoc(rowDoc(userId, date));

/** Ask the server for the tape's readings: { ok, status, data } (data {} when unreadable). */
export async function fetchTapeRecords(userId) {
  const res = await fetch("/api/renpho-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, kind: "girth" }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
