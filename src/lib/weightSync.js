// src/lib/weightSync.js — Weight and Body tab updates: Renpho sync, purge, new body rows.

const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");

/** Synced rows: weight and scale metrics from Renpho win; week / dose / projected are kept. */
export function renphoRows(weightLog, records) {
  const existing = new Map(weightLog.map((r) => [r.date, r]));
  return records.map((rec) => ({
    ...(existing.get(rec.date) || {}),
    date: rec.date,
    actual: rec.weight,
    ...(rec.metrics ? { renpho: rec.metrics } : {}),
  }));
}

/** The log with rows added or replaced, in date order. */
export function withRows(log, rows) {
  const next = new Map(log.map((r) => [r.date, r]));
  rows.forEach((row) => next.set(row.date, row));
  return [...next.values()].sort(byDate);
}

export function renphoSyncedText(data, count) {
  const rejected = data.rejected ? ` (${data.rejected} before ${data.fromDate} ignored)` : "";
  return `Synced ${count} measurement${count !== 1 ? "s" : ""}${rejected}.`;
}

const isBefore = (row, cutoff) => row.date && row.date < cutoff;

/** Rows dated before the cutoff. */
export const rowsBefore = (log, cutoff) => log.filter((r) => isBefore(r, cutoff));
export const withoutRowsBefore = (log, cutoff) => log.filter((r) => !isBefore(r, cutoff));

export const withBodyRow = (log, row) => [...log, row].sort(byDate);

/** Polar sessions after a sync: new unlogged ones added (no duplicates), newest first. */
export function withSyncedSessions(sessions, synced) {
  const ids = new Set(sessions.map((s) => s.id));
  return [...synced.filter((s) => !ids.has(s.id) && !s.logged), ...sessions].sort((a, b) =>
    (b.start_time || "").localeCompare(a.start_time || ""),
  );
}

export const polarSyncedText = (n) => `Synced ${n} session${n !== 1 ? "s" : ""}.`;
