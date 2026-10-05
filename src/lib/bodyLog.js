// src/lib/bodyLog.js — the Body tab's log: reading typed values, changing one reading, the table's
// row order and shading, and merging Renpho tape-measure records into the log.

/** A typed reading: a number, or null when blank or not a number. */
export function toReading(text) {
  const t = String(text).trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Row i with one site changed (change: { [site]: value }): the new row, and the log with it. */
export function withReading(bodyLog, i, change) {
  const row = { ...bodyLog[i], ...change };
  return { row, rows: bodyLog.map((r, j) => (j === i ? row : r)) };
}

/** Rows newest first, each with its index in the log. */
export const newestFirst = (bodyLog) => bodyLog.map((row, i) => ({ row, i })).reverse();

/** Row background: the latest row highlighted, the rest striped by index. */
export function rowBackground(i, count) {
  if (i === count - 1) return "#E3F2FD";
  return i % 2 === 0 ? "#fff" : "#F7FAFD";
}

/**
 * Tape records ({ date, values }) merged into the log: synced sites overwrite that day's values,
 * sites the tape didn't send keep any manual entry. merged: the rows to save; rows: the new log,
 * in date order.
 */
export function mergeTapeRecords(bodyLog, records) {
  const existing = new Map(bodyLog.map((r) => [r.date, r]));
  const merged = records.map((rec) => ({
    ...(existing.get(rec.date) || {}),
    date: rec.date,
    ...rec.values,
  }));
  merged.forEach((row) => existing.set(row.date, row));
  const rows = [...existing.values()].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return { merged, rows };
}

/** "Synced 1 day." / "Synced 3 days." */
export const syncedText = (n) => `Synced ${n} day${n !== 1 ? "s" : ""}.`;

/** The error for a failed sync reply: the server's message, else its status. */
export const syncError = (status, data) => data.error || `Sync failed (HTTP ${status})`;
