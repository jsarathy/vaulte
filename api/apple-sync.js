// api/apple-sync.js — receives Apple Health samples from an iOS Shortcut
// and stores them as 5-minute slots in users/{uid}/apple_activity/{date}.
//
// POST /api/apple-sync
// Two body formats: daily totals { date, steps, active, flights } (numbers), or timestamped samples below.
// Daily-totals mode may also carry hourly steps (Find Health Samples, Group by Hour):
//   hourly_steps: [812, 1540, ...]   hourly_start: ["2026-09-27T07:00:00+01:00", ...]  (same order)
// Hours with no steps are simply absent (Fill Missing OFF), hence the start times.
// Stored as hourly: { "07": 812, "08": 1540, ... } alongside totals.
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
  const hasWatch = list.some((x) => /watch/i.test(x?.src || ""));
  return hasWatch ? list.filter((x) => /watch/i.test(x?.src || "")) : list;
}

// Spread each sample's value across the 5-min slots it overlaps (pro-rata), for the target date only.
export function bucketSamples(samples, date, idx, slots) {
  for (const x of pickSource(samples)) {
    const v = Number(x?.v);
    const a = parseLocal(x?.s),
      b = parseLocal(x?.e || x?.s);
    if (!a || !b || !isFinite(v) || v <= 0) continue;
    let start = a.min,
      end = b.min;
    if (b.date > a.date) end += 1440; // crosses midnight
    if (a.date < date && b.date === date) {
      start -= 1440;
      end -= 1440;
    } // started previous day
    else if (a.date !== date) continue;
    const dur = Math.max(end - start, 0);
    const from = Math.max(start, 0),
      to = Math.min(end, 1440);
    if (dur === 0) {
      // instantaneous sample
      if (start < 0 || start >= 1440) continue;
      add(slots, Math.floor(start / 5) * 5, idx, v);
      continue;
    }
    for (let s0 = Math.floor(from / 5) * 5; s0 < to; s0 += 5) {
      const ov = Math.min(s0 + 5, to) - Math.max(s0, from);
      if (ov > 0) add(slots, s0, idx, (v * ov) / dur);
    }
  }
}

// Shortcuts' default date text, e.g. "27 Sep 2026 at 07:00", "27/09/2026, 07:00", "Sep 27, 2026 at 7:00 AM".
const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
function parseLoose(str) {
  const s = String(str || "");
  let y, mo, d;
  let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); // 27/09/2026 (UK order)
  if (m) {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  } else if ((m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(s))) {
    d = +m[1];
    mo = MONTHS[m[2].toLowerCase()];
    y = +m[3];
  } else if ((m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s))) {
    mo = MONTHS[m[1].toLowerCase()];
    d = +m[2];
    y = +m[3];
  }
  const t = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/.exec(s.replace(/\d{4}/, ""));
  if (!y || !mo || !d || !t) return null;
  let h = +t[1];
  if (t[3]) {
    const pm = /p/i.test(t[3]);
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  const date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { date, min: h * 60 + +t[2] };
}

// Shortcut lists may arrive as JSON arrays or newline-separated text.
function toList(x) {
  if (Array.isArray(x)) return x;
  if (x == null || x === "") return [];
  return String(x)
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

// Zip hourly values with their start times → { "HH": steps }. Returns null if nothing usable.
export function buildHourly(values, starts, date) {
  const vals = toList(values),
    sts = toList(starts);
  if (!vals.length || vals.length !== sts.length) return null;
  const out = {};
  vals.forEach((v, i) => {
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    const t = parseLocal(sts[i]) || parseLoose(sts[i]);
    if (!t || t.date !== date || !isFinite(n) || n <= 0) return;
    const hh = String(Math.floor(t.min / 60)).padStart(2, "0");
    out[hh] = (out[hh] || 0) + Math.round(n);
  });
  return Object.keys(out).length ? out : null;
}

function add(slots, slotMin, idx, val) {
  const key =
    String(Math.floor(slotMin / 60)).padStart(2, "0") + String(slotMin % 60).padStart(2, "0");
  const arr = slots[key] || (slots[key] = [0, 0, 0]);
  arr[idx] += val;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!tokenOk(req)) return res.status(401).json({ error: "Unauthorized" });

  const userId = process.env.APPLE_SYNC_USER_ID;
  if (!userId) return res.status(500).json({ error: "APPLE_SYNC_USER_ID not configured" });

  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  const { steps, active, flights } = body || {};
  // Accept any value containing YYYY-MM-DD; fall back to today in UK time
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(body?.date ?? ""));
  // Also accept Shortcuts' default date text ("Sep 26, 2026", "26 Sep 2026", "26/09/2026") so a backfill never lands on today by mistake
  const loose = m ? null : parseLoose(`${body?.date ?? ""} 12:00`);
  if (!m && !loose && body?.date)
    return res.status(400).json({ error: `Unrecognised date: ${body.date}` });
  const date = m
    ? m[1]
    : loose
      ? loose.date
      : new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  // Daily-totals mode (Shortcut sends plain numbers): { date, steps, active, flights }
  if (![steps, active, flights].some(Array.isArray)) {
    const num = (x) => {
      const n = Number(String(x ?? "").replace(/[^0-9.-]/g, ""));
      return isFinite(n) ? n : 0;
    };
    const totals = {
      steps: Math.round(num(steps)),
      activeMin: Math.round(num(active)),
      flights: Math.round(num(flights)),
    };
    const hourly = buildHourly(body?.hourly_steps, body?.hourly_start, date);
    try {
      await getAdminDb()
        .doc(`users/${userId}/apple_activity/${date}`)
        .set({
          date,
          mode: "daily",
          updated_at: new Date().toISOString(),
          totals,
          ...(hourly ? { hourly } : {}),
        });
      return res.json({
        ok: true,
        date,
        totals,
        hourly_hours: hourly ? Object.keys(hourly).length : 0,
      });
    } catch (e) {
      console.error("apple-sync write failed:", e);
      return res.status(500).json({ error: "Firestore write failed" });
    }
  }

  const slots = {};
  bucketSamples(steps, date, 0, slots);
  bucketSamples(active, date, 1, slots);
  bucketSamples(flights, date, 2, slots);

  // Round: steps/flights 1 dp, minutes 2 dp; drop empty slots
  let totSteps = 0,
    totActive = 0,
    totFlights = 0;
  for (const k of Object.keys(slots)) {
    const [st, am, fl] = slots[k];
    slots[k] = [Math.round(st * 10) / 10, Math.round(am * 100) / 100, Math.round(fl * 10) / 10];
    if (!slots[k].some(Boolean)) {
      delete slots[k];
      continue;
    }
    totSteps += st;
    totActive += am;
    totFlights += fl;
  }

  try {
    const db = getAdminDb();
    await db.doc(`users/${userId}/apple_activity/${date}`).set({
      date,
      updated_at: new Date().toISOString(),
      slots,
      totals: {
        steps: Math.round(totSteps),
        activeMin: Math.round(totActive),
        flights: Math.round(totFlights),
      },
    });
    return res.json({
      ok: true,
      date,
      slots: Object.keys(slots).length,
      totals: {
        steps: Math.round(totSteps),
        activeMin: Math.round(totActive),
        flights: Math.round(totFlights),
      },
    });
  } catch (e) {
    console.error("apple-sync write failed:", e);
    return res.status(500).json({ error: "Firestore write failed" });
  }
}
