// api/_renpho/girth.js — Smart Tape Measure (body girth) readings for the Body tab: one record
// per day in the device's own time zone, sites in cm.
import { ENDPOINTS, fetchPages } from "./client.js";
import { epochMs, latestPerDay } from "./days.js";

// Renpho field -> Body tab key. The overall arm/thigh/calf fields and the custom slots aren't used.
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
const OFFSET = /^([+-])?(\d+(?:\.\d+)?)(?::(\d+))?$/; // "+1:00", "-5", "+5.5"

/** The girth endpoint identifies the user from the headers: no table or user id. */
export const fetchGirths = (auth) =>
  fetchPages({ endpoint: ENDPOINTS.girth, body: {}, auth, pageSize: 100, label: "Girth" });

/** The device's UTC offset in seconds (0 when missing or unreadable). */
function offsetSeconds(timeZone) {
  const m = String(timeZone ?? "")
    .trim()
    .match(OFFSET);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3] || 0) * 60);
}

/** The reading's date where it was taken; null for a missing or non-positive timestamp. */
function girthDate(m) {
  const ts = Number(m.timeStamp);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const ms = epochMs(ts) + offsetSeconds(m.timeZone) * 1000;
  return new Date(ms).toISOString().split("T")[0];
}

/** Measured sites to 1 dp (unmeasured sites come back as 0 and are dropped). */
function girthValues(m) {
  const values = {};
  for (const [field, key] of Object.entries(GIRTH_FIELDS)) {
    const n = Number(m[field]);
    if (Number.isFinite(n) && n > 0) values[key] = +n.toFixed(1);
  }
  return values;
}

function girthEntry(m) {
  const date = girthDate(m);
  const values = date ? girthValues(m) : {};
  if (!Object.keys(values).length) return null;
  return { date, ts: Number(m.timeStamp) || 0, record: { date, values } };
}

/** One record per day (latest reading wins); readings with nothing measured are skipped. */
export const girthRecords = (raw) => latestPerDay(raw.map(girthEntry).filter(Boolean));
