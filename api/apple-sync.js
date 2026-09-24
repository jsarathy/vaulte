// api/apple-sync.js — receives Apple Health samples from an iOS Shortcut
// and stores them as 5-minute slots in users/{uid}/apple_activity/{date}.
//
// POST /api/apple-sync
// Two body formats: daily totals { date, steps, active, flights } (numbers), or timestamped samples below.
// Headers: Authorization: Bearer <APPLE_SYNC_TOKEN>
// Body: {
//   date:    "YYYY-MM-DD",                       // day being synced (whole day is replaced)
//   steps:   [{ s:"<start ISO>", e:"<end ISO>", v:<number>, src?:"<source name>" }, ...],
//   active:  [ ...same shape, v = exercise minutes ],
//   flights: [ ...same shape, v = flights climbed ]
// }
// Times are read as local wall-clock (the HH:MM in the string), matching Polar start_time.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { timingSafeEqual } from "crypto";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

function tokenOk(req) {
  const expected = process.env.APPLE_SYNC_TOKEN || "";
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// "2026-09-24T09:32:10+01:00" or "2026-09-24 09:32" → { date:"2026-09-24", min: 572.17 }
function parseLocal(str) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(str || "").trim());
  if (!m) return null;
  return { date: m[1], min: +m[2] * 60 + +m[3] + (+m[4] || 0) / 60 };
}

// If samples come from several sources (iPhone + Watch), keep only the Watch ones to avoid double counting.
function pickSource(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const hasWatch = list.some(x => /watch/i.test(x?.src || ""));
  return hasWatch ? list.filter(x => /watch/i.test(x?.src || "")) : list;
}

// Spread each sample's value across the 5-min slots it overlaps (pro-rata), for the target date only.
export function bucketSamples(samples, date, idx, slots) {
  for (const x of pickSource(samples)) {
    const v = Number(x?.v);
    const a = parseLocal(x?.s), b = parseLocal(x?.e || x?.s);
    if (!a || !b || !isFinite(v) || v <= 0) continue;
    let start = a.min, end = b.min;
    if (b.date > a.date) end += 1440;             // crosses midnight
    if (a.date < date && b.date === date) { start -= 1440; end -= 1440; } // started previous day
    else if (a.date !== date) continue;
    const dur = Math.max(end - start, 0);
    const from = Math.max(start, 0), to = Math.min(end, 1440);
    if (dur === 0) {                               // instantaneous sample
      if (start < 0 || start >= 1440) continue;
      add(slots, Math.floor(start / 5) * 5, idx, v);
      continue;
    }
    for (let s0 = Math.floor(from / 5) * 5; s0 < to; s0 += 5) {
      const ov = Math.min(s0 + 5, to) - Math.max(s0, from);
      if (ov > 0) add(slots, s0, idx, v * ov / dur);
    }
  }
}

function add(slots, slotMin, idx, val) {
  const key = String(Math.floor(slotMin / 60)).padStart(2, "0") + String(slotMin % 60).padStart(2, "0");
  const arr = slots[key] || (slots[key] = [0, 0, 0]);
  arr[idx] += val;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!tokenOk(req)) return res.status(401).json({ error: "Unauthorized" });

  const userId = process.env.APPLE_SYNC_USER_ID;
  if (!userId) return res.status(500).json({ error: "APPLE_SYNC_USER_ID not configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); } }
  const { date, steps, active, flights } = body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ error: "Missing or invalid date (YYYY-MM-DD)" });

  // Daily-totals mode (Shortcut sends plain numbers): { date, steps, active, flights }
  if (![steps, active, flights].some(Array.isArray)) {
    const num = x => { const n = Number(String(x ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
    const totals = { steps: Math.round(num(steps)), activeMin: Math.round(num(active)), flights: Math.round(num(flights)) };
    try {
      await getAdminDb().doc(`users/${userId}/apple_activity/${date}`).set({ date, mode: "daily", updated_at: new Date().toISOString(), totals });
      return res.json({ ok: true, date, totals });
    } catch (e) {
      console.error("apple-sync write failed:", e);
      return res.status(500).json({ error: "Firestore write failed" });
    }
  }

  const slots = {};
  bucketSamples(steps,   date, 0, slots);
  bucketSamples(active,  date, 1, slots);
  bucketSamples(flights, date, 2, slots);

  // Round: steps/flights 1 dp, minutes 2 dp; drop empty slots
  let totSteps = 0, totActive = 0, totFlights = 0;
  for (const k of Object.keys(slots)) {
    const [st, am, fl] = slots[k];
    slots[k] = [Math.round(st * 10) / 10, Math.round(am * 100) / 100, Math.round(fl * 10) / 10];
    if (!slots[k].some(Boolean)) { delete slots[k]; continue; }
    totSteps += st; totActive += am; totFlights += fl;
  }

  try {
    const db = getAdminDb();
    await db.doc(`users/${userId}/apple_activity/${date}`).set({
      date,
      updated_at: new Date().toISOString(),
      slots,
      totals: { steps: Math.round(totSteps), activeMin: Math.round(totActive), flights: Math.round(totFlights) },
    });
    return res.json({ ok: true, date, slots: Object.keys(slots).length,
      totals: { steps: Math.round(totSteps), activeMin: Math.round(totActive), flights: Math.round(totFlights) } });
  } catch (e) {
    console.error("apple-sync write failed:", e);
    return res.status(500).json({ error: "Firestore write failed" });
  }
}
