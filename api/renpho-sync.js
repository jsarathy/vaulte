// api/renpho-sync.js
// Pulls weight measurements from the Renpho Health cloud (cloud.renpho.com).
// With { kind: "girth" } in the body it instead pulls Smart Tape Measure
// (body girth) readings for the Body tab.
//
// There is no official Renpho API. The endpoints, the AES-128-ECB envelope and
// the payload shapes below come from reverse-engineered clients and can break
// without notice. Credentials stay server-side: never call this from the client
// with the email/password in the body.
//
// Required Vercel env vars:
//   RENPHO_EMAIL
//   RENPHO_PASSWORD

import {
  ENDPOINTS,
  checkResponse,
  decryptResponse,
  encryptRequest,
  fetchPages,
  login,
  post,
} from "./_renpho/client.js";

// Smart Tape Measure: Renpho field -> Body tab key (all cm). The overall
// arm/thigh/calf fields and the custom slots are not used.
const GIRTH_FIELDS = {
  neckValue: "neck",
  shoulderValue: "shoulder",
  chestValue: "chest",
  waistValue: "waist",
  abdomenValue: "abdomen",
  hipValue: "hip",
  leftArmValue: "bicepL",
  rightArmValue: "bicepR",
  leftThighValue: "thighL",
  rightThighValue: "thighR",
  leftCalfValue: "calfL",
  rightCalfValue: "calfR",
};

const fetchPaged = (endpoint, tableName, uid, auth) =>
  fetchPages({
    endpoint,
    body: { userIds: [String(uid)], tableName },
    auth,
    pageSize: 50,
    label: endpoint,
  });

// Fields that describe the record rather than the body — never surfaced as metrics.
const NON_METRIC =
  /(^id$|id$|Id$|ids$|time|stamp|date|created|updated|unit|type|flag|status|version|mac|^sn$|serial|scale|table|device|sex|gender|^age$|height|method|mode|^local|timezone|source|deleted|sync|^tz)/i;

// Every finite, non-zero number on the record except bookkeeping fields.
// Renpho reports 0 for anything the scale didn't measure, so zeros are dropped.
function extractMetrics(m) {
  const out = {};
  for (const [k, v] of Object.entries(m || {})) {
    if (NON_METRIC.test(k)) continue;
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n) || n === 0) continue;
    out[k] = +n.toFixed(2);
  }
  return out;
}

// Renpho timestamps are epoch seconds on some records, ms on others.
function toISODate(ts) {
  if (ts == null) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  return isNaN(d) ? null : d.toISOString().split("T")[0];
}

// Girth records carry the device's own UTC offset ("+1:00"); use it for the date.
function girthDate(m) {
  const ts = Number(m.timeStamp);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const tz = String(m.timeZone ?? "").trim();
  let off = 0;
  const mt = tz.match(/^([+-])?(\d+(?:\.\d+)?)(?::(\d+))?$/);
  if (mt) off = (mt[1] === "-" ? -1 : 1) * (Number(mt[2]) * 3600 + Number(mt[3] || 0) * 60);
  const ms = (ts < 1e12 ? ts * 1000 : ts) + off * 1000;
  return new Date(ms).toISOString().split("T")[0];
}

// The girth endpoint identifies the user from the headers: no table or user id.
const fetchGirths = (auth) =>
  fetchPages({ endpoint: ENDPOINTS.girth, body: {}, auth, pageSize: 100, label: "Girth" });

async function girthHandler(req, res, auth) {
  const raw = await fetchGirths(auth);
  // One record per calendar day: latest reading wins. Unmeasured sites come back as 0 and are dropped.
  const byDate = new Map();
  for (const m of raw) {
    const date = girthDate(m);
    if (!date) continue;
    const values = {};
    for (const [field, key] of Object.entries(GIRTH_FIELDS)) {
      const n = Number(m[field]);
      if (Number.isFinite(n) && n > 0) values[key] = +n.toFixed(1);
    }
    if (!Object.keys(values).length) continue;
    const ts = Number(m.timeStamp) || 0;
    const prev = byDate.get(date);
    if (!prev || ts >= prev.ts) byDate.set(date, { date, values, ts });
  }
  const records = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, values }) => ({ date, values }));
  return res.status(200).json({ records, count: records.length, rawCount: raw.length });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Hard cutoff: measurements dated before this are rejected outright, so stale
  // readings already sitting in the Renpho cloud can never re-enter the log.
  const fromDate =
    typeof req.body?.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.fromDate)
      ? req.body.fromDate
      : null;

  const email = process.env.RENPHO_EMAIL;
  const password = process.env.RENPHO_PASSWORD;
  if (!email || !password) {
    return res.status(500).json({ error: "RENPHO_EMAIL / RENPHO_PASSWORD not configured" });
  }

  try {
    const auth = await login(email, password);
    if (req.body?.kind === "girth") return await girthHandler(req, res, auth);

    const devResult = await post(ENDPOINTS.deviceInfo, encryptRequest({}), auth);
    checkResponse(devResult, "DeviceInfo");
    const devInfo = devResult.data ? decryptResponse(devResult.data) : {};
    const scales = Array.isArray(devInfo.scale) ? devInfo.scale : [];

    if (!scales.length) {
      return res.status(200).json({
        records: [],
        count: 0,
        warning: "No scale found on the account. Open the Renpho Health app and let it sync.",
      });
    }

    const raw = [];
    for (const scale of scales) {
      const tableName = scale?.tableName;
      if (!tableName) continue;
      const uids = Array.isArray(scale.userIds) ? scale.userIds : [];
      const uid = uids.length && !uids.includes(auth.userId) ? uids[0] : auth.userId;

      // Body-composition endpoint first; weight-only scales answer on the basic one.
      let recs = await fetchPaged(ENDPOINTS.bodyComposition, tableName, uid, auth);
      if (!recs.length) recs = await fetchPaged(ENDPOINTS.measurements, tableName, uid, auth);
      raw.push(...recs);
    }

    // One record per calendar day: latest reading wins. All metrics ride along.
    const byDate = new Map();
    let rejected = 0;
    for (const m of raw) {
      const date = toISODate(m.timeStamp ?? m.timestamp ?? m.created_at);
      const weight = Number(m.weight);
      if (!date || !Number.isFinite(weight) || weight <= 0) continue;
      if (fromDate && date < fromDate) {
        rejected++;
        continue;
      }
      const ts = Number(m.timeStamp ?? m.timestamp ?? 0);
      const prev = byDate.get(date);
      if (!prev || ts >= prev.ts)
        byDate.set(date, { date, weight: +weight.toFixed(2), metrics: extractMetrics(m), ts });
    }

    const records = [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, weight, metrics }) => ({ date, weight, metrics }));
    const metricKeys = [...new Set(records.flatMap((r) => Object.keys(r.metrics)))].sort();

    return res.status(200).json({
      records,
      count: records.length,
      rawCount: raw.length,
      rejected,
      fromDate,
      metricKeys,
    });
  } catch (err) {
    console.error("renpho-sync error:", err);
    return res.status(502).json({ error: err.message || "Renpho sync failed" });
  }
}
