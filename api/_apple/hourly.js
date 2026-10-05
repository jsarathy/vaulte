// api/_apple/hourly.js — daily-totals mode: hourly step counts (Find Health Samples, Group by
// Hour) zipped with their start times. Hours with no steps are absent (Fill Missing OFF).
import { parseLocal, parseLoose, toList } from "./time.js";

/** A count from a Shortcut value such as "1,540 steps" (NaN when nothing numeric is left). */
export const count = (x) => Number(String(x ?? "").replace(/[^0-9.-]/g, ""));

/** { "HH": steps } from parallel value / start-time lists; null if nothing on the date is usable. */
export function buildHourly(values, starts, date) {
  const vals = toList(values);
  const sts = toList(starts);
  if (!vals.length || vals.length !== sts.length) return null;
  const out = {};
  vals.forEach((v, i) => {
    const n = count(v);
    const t = parseLocal(sts[i]) || parseLoose(sts[i]);
    if (!t || t.date !== date || !isFinite(n) || n <= 0) return;
    const hh = String(Math.floor(t.min / 60)).padStart(2, "0");
    out[hh] = (out[hh] || 0) + Math.round(n);
  });
  return Object.keys(out).length ? out : null;
}
