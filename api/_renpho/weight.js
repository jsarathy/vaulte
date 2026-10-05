// api/_renpho/weight.js — weight readings for /api/renpho-sync: the account's scales, their
// measurements (body-composition endpoint first; weight-only scales answer on the basic one),
// and one record per day with every body metric riding along.
import {
  ENDPOINTS,
  checkResponse,
  decryptResponse,
  encryptRequest,
  fetchPages,
  post,
} from "./client.js";
import { latestPerDay, toISODate } from "./days.js";

// Fields that describe the record rather than the body — never surfaced as metrics.
const NON_METRIC =
  /(id$|ids$|time|stamp|date|created|updated|unit|type|flag|status|version|mac|^sn$|serial|scale|table|device|sex|gender|^age$|height|method|mode|^local|timezone|source|deleted|sync|^tz)/i;

/** The account's scales (none when the device list is missing). */
export async function fetchScales(auth) {
  const result = await post(ENDPOINTS.deviceInfo, encryptRequest({}), auth);
  checkResponse(result, "DeviceInfo");
  const devices = result.data ? decryptResponse(result.data) : {};
  return Array.isArray(devices.scale) ? devices.scale : [];
}

/** The scale's user to ask for: the account's own user if listed (or none listed), else the first. */
function scaleUser(scale, auth) {
  const ids = Array.isArray(scale.userIds) ? scale.userIds : [];
  return ids.length && !ids.includes(auth.userId) ? ids[0] : auth.userId;
}

const fetchTable = (endpoint, scale, auth) =>
  fetchPages({
    endpoint,
    body: { userIds: [String(scaleUser(scale, auth))], tableName: scale.tableName },
    auth,
    pageSize: 50,
    label: endpoint,
  });

/** Every measurement on the account's scales (scales without a table are skipped). */
export async function fetchMeasurements(scales, auth) {
  const raw = [];
  for (const scale of scales.filter((s) => s?.tableName)) {
    const recs = await fetchTable(ENDPOINTS.bodyComposition, scale, auth);
    raw.push(...(recs.length ? recs : await fetchTable(ENDPOINTS.measurements, scale, auth)));
  }
  return raw;
}

const metricValue = (v) => (typeof v === "string" ? Number(v) : v); // "" → 0: dropped

/** Every finite, non-zero number on the record except bookkeeping fields (Renpho sends 0 for
 *  anything the scale didn't measure), to 2 dp. */
export function extractMetrics(m) {
  const out = {};
  for (const [k, v] of Object.entries(m || {})) {
    const n = metricValue(v);
    const usable = !NON_METRIC.test(k) && typeof n === "number" && Number.isFinite(n) && n !== 0;
    if (usable) out[k] = +n.toFixed(2);
  }
  return out;
}

/** A dated, weighed reading as a day entry; null if it has no date or weight. */
function weightEntry(m) {
  const date = toISODate(m.timeStamp ?? m.timestamp ?? m.created_at);
  const weight = Number(m.weight);
  if (!date || !Number.isFinite(weight) || weight <= 0) return null;
  const record = { date, weight: +weight.toFixed(2), metrics: extractMetrics(m) };
  return { date, ts: Number(m.timeStamp ?? m.timestamp ?? 0), record };
}

/**
 * One record per day (latest reading wins). Readings dated before fromDate are rejected
 * outright, so stale readings in the Renpho cloud can never re-enter the log.
 */
export function weightRecords(raw, fromDate) {
  const entries = raw.map(weightEntry).filter(Boolean);
  const kept = entries.filter((e) => !fromDate || e.date >= fromDate);
  const records = latestPerDay(kept);
  const metricKeys = [...new Set(records.flatMap((r) => Object.keys(r.metrics)))].sort();
  return { records, rejected: entries.length - kept.length, metricKeys };
}
