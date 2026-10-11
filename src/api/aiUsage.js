// src/api/aiUsage.js — the signed-in user's own Claude usage records (users/{uid}/ai_usage,
// written by /api/claude; Fix 41), newest first.
import { db } from "../firebase";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";

const MAX_RECORDS = 2000;

export async function loadMyUsage(userId) {
  const col = collection(db, "users", userId, "ai_usage");
  const snap = await getDocs(query(col, orderBy("at", "desc"), limit(MAX_RECORDS)));
  return snap.docs.map((d) => d.data());
}
