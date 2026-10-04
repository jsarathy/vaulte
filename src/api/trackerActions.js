// src/api/trackerActions.js — NutritionTracker's writes and sync calls: weight plan, body rows,
// weight rows, and the Renpho / Polar sync endpoints.
import { db } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

const userDoc = (userId, ...path) => doc(db, "users", userId, ...path);

export const saveWeightPlan = (userId, cfg) =>
  setDoc(userDoc(userId, "weight_plan", "settings"), cfg);
export const createBodyRow = (userId, row) => setDoc(userDoc(userId, "body_log", row.date), row);
export const saveWeightRows = (userId, rows) =>
  Promise.all(rows.map((row) => setDoc(userDoc(userId, "weight_log", row.date), row)));
export const deleteWeightRows = (userId, rows) =>
  Promise.all(rows.map((r) => deleteDoc(userDoc(userId, "weight_log", r.date))));

/** POST to a sync endpoint; the reply, or an error with the server's message. */
async function postSync(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sync failed");
  return data;
}

export const requestRenphoSync = (userId, fromDate) =>
  postSync("/api/renpho-sync", { userId, fromDate });
export const requestPolarSync = (userId) => postSync("/api/polar-sync", { userId });
