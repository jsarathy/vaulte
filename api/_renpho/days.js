// api/_renpho/days.js — Renpho readings reduced to one per calendar day, and dates from Renpho's
// timestamps (epoch seconds on some records, milliseconds on others).

const SECONDS_BELOW = 1e12; // timestamps under this are seconds

export const epochMs = (ts) => (ts < SECONDS_BELOW ? ts * 1000 : ts);

/** "YYYY-MM-DD" (UTC) of a timestamp; null for a missing, non-positive or unusable one. */
export function toISODate(ts) {
  const n = Number(ts);
  if (!(n > 0)) return null; // missing, unreadable, zero or negative
  const d = new Date(epochMs(n));
  return isNaN(d) ? null : d.toISOString().split("T")[0];
}

/**
 * One entry per date — the latest by ts (a tie goes to the later entry) — sorted by date.
 * entries: [{ date, ts, record }]; returns the records.
 */
export function latestPerDay(entries) {
  const byDate = new Map();
  for (const e of entries) {
    const prev = byDate.get(e.date);
    if (!prev || e.ts >= prev.ts) byDate.set(e.date, e);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.record);
}
