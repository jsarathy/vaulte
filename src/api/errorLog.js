// src/api/errorLog.js — the app error log in Firestore (users/{uid}/app_errors, Fix 98 part 2).
import { db } from "../firebase";
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";

const MAX_READ = 200;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const saveError = (userId, entry) =>
  setDoc(doc(db, "users", userId, "app_errors", newId()), entry);

/** The newest entries first (up to 200). */
export async function loadErrors(userId) {
  const col = collection(db, "users", userId, "app_errors");
  const snap = await getDocs(query(col, orderBy("at", "desc"), limit(MAX_READ)));
  return snap.docs.map((d) => d.data());
}
