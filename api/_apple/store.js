// api/_apple/store.js — the day's record for users/{uid}/apple_activity/{date}, built from the
// request in either body format, and written with the Firebase Admin SDK.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildHourly, count } from "./hourly.js";
import { bucketSamples, combineSlots } from "./samples.js";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

/** Daily-totals mode: the Shortcut sent plain numbers rather than sample lists. */
export const isDailyMode = ({ steps, active, flights }) =>
  ![steps, active, flights].some(Array.isArray);

const whole = (x) => {
  const n = count(x);
  return Math.round(isFinite(n) ? n : 0);
};

/** { record, reply } for daily totals (+ optional hourly steps). */
export function dailyRecord(body, date) {
  const totals = {
    steps: whole(body.steps),
    activeMin: whole(body.active),
    flights: whole(body.flights),
  };
  const hourly = buildHourly(body.hourly_steps, body.hourly_start, date);
  const updated_at = new Date().toISOString();
  return {
    record: { date, mode: "daily", updated_at, totals, ...(hourly ? { hourly } : {}) },
    reply: { totals, hourly_hours: hourly ? Object.keys(hourly).length : 0 },
  };
}

/** { record, reply } for timestamped samples bucketed into 5-minute slots. */
export function slotRecord({ steps, active, flights }, date) {
  const { slots, totals } = combineSlots(
    [steps, active, flights].map((samples) => bucketSamples(samples, date)),
  );
  return {
    record: { date, updated_at: new Date().toISOString(), slots, totals },
    reply: { slots: Object.keys(slots).length, totals },
  };
}

/** Replace the whole day's record. */
export const writeDay = (userId, date, record) =>
  getAdminDb().doc(`users/${userId}/apple_activity/${date}`).set(record);
