// api/_apple/samples.js — timestamped Apple Health samples ({ s, e, v, src }) spread over the
// day's 5-minute slots, and the three metrics combined into the stored slots / totals.
import { parseLocal } from "./time.js";

const DAY = 1440; // minutes
const SLOT = 5;
const slotStart = (min) => Math.floor(min / SLOT) * SLOT;

/** Keep only the Watch samples when several sources (iPhone + Watch) report, to avoid double counting. */
export function pickSource(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const isWatch = (x) => /watch/i.test(x?.src || "");
  return list.some(isWatch) ? list.filter(isWatch) : list;
}

/** A sample's parsed start / end and value; null when unparseable or without a positive value. */
function parseSample(x) {
  const v = Number(x?.v);
  const a = parseLocal(x?.s);
  const b = parseLocal(x?.e || x?.s);
  return a && b && isFinite(v) && v > 0 ? { a, b, v } : null;
}

/**
 * The sample as minutes relative to `date`'s midnight (negative when it started the day before);
 * null when it does not touch the date. A sample ending on a later day runs past 1440.
 */
function windowOnDate({ a, b, v }, date) {
  const startedBefore = a.date < date && b.date === date;
  if (!startedBefore && a.date !== date) return null;
  const shift = startedBefore ? -DAY : 0;
  const end = b.min + (b.date > a.date ? DAY : 0);
  return { start: a.min + shift, end: end + shift, v };
}

const add = (out, slotMin, val) => {
  out[slotMin] = (out[slotMin] || 0) + val;
};

/** Spread the value across the slots the window overlaps (pro-rata), within the day only. */
function spread({ start, end, v }, out) {
  const dur = Math.max(end - start, 0);
  if (dur === 0) {
    if (start >= 0 && start < DAY) add(out, slotStart(start), v); // instantaneous sample
    return;
  }
  const from = Math.max(start, 0);
  const to = Math.min(end, DAY);
  for (let s0 = slotStart(from); s0 < to; s0 += SLOT) {
    const ov = Math.min(s0 + SLOT, to) - Math.max(s0, from);
    if (ov > 0) add(out, s0, (v * ov) / dur);
  }
}

/** { [slotMinute]: value } for the target date from one metric's samples. */
export function bucketSamples(samples, date) {
  const out = {};
  for (const x of pickSource(samples)) {
    const parsed = parseSample(x);
    const w = parsed && windowOnDate(parsed, date);
    if (w) spread(w, out);
  }
  return out;
}

const slotKey = (min) =>
  String(Math.floor(min / 60)).padStart(2, "0") + String(min % 60).padStart(2, "0");
const SCALE = [10, 100, 10]; // steps 1 dp, minutes 2 dp, flights 1 dp
const roundSlot = (vals) => vals.map((v, i) => Math.round(v * SCALE[i]) / SCALE[i]);

/** { "HHMM": [steps, activeMin, flights] } with the metrics' raw slot values side by side. */
function mergeMetrics(metrics) {
  const raw = {};
  metrics.forEach((perSlot, idx) => {
    for (const [min, v] of Object.entries(perSlot)) {
      const key = slotKey(+min);
      (raw[key] || (raw[key] = [0, 0, 0]))[idx] = v;
    }
  });
  return raw;
}

/**
 * The stored shape from [steps, active, flights] slot maps: slots rounded with empty ones dropped,
 * and totals from the unrounded values of the slots kept.
 */
export function combineSlots(metrics) {
  const slots = {};
  const tot = [0, 0, 0];
  for (const [key, vals] of Object.entries(mergeMetrics(metrics))) {
    const rounded = roundSlot(vals);
    if (!rounded.some(Boolean)) continue;
    slots[key] = rounded;
    vals.forEach((v, i) => (tot[i] += v));
  }
  const totals = {
    steps: Math.round(tot[0]),
    activeMin: Math.round(tot[1]),
    flights: Math.round(tot[2]),
  };
  return { slots, totals };
}
