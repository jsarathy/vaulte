// src/api/aiUsage.js — the signed-in user's own Claude usage records (users/{uid}/ai_usage,
// written by /api/claude; Fix 41), newest first.
import { db } from "../firebase";
import { collection, getDocs, orderBy, query, limit, where } from "firebase/firestore";

const MAX_RECORDS = 2000;

/** The user's records from `sinceIso` on, newest first (a query on the time field). */
export async function loadMyUsage(userId, sinceIso) {
  const col = collection(db, "users", userId, "ai_usage");
  const snap = await getDocs(
    query(col, where("at", ">=", sinceIso), orderBy("at", "desc"), limit(MAX_RECORDS)),
  );
  return snap.docs.map((d) => d.data());
}
