// src/lib/weightEntry.js — the weight entry box: the form for a date and the weight_log row it saves.

/** The form for a date: that date's row (blanks for missing fields), or an empty new entry. */
export function entryFor(weightLog, date) {
  const row = weightLog.find((r) => r.date === date) || {};
  return {
    date,
    week: row.week ?? "",
    dose: row.dose ?? "",
    projected: row.projected ?? "",
    actual: row.actual ?? "",
    existing: !!row.date,
  };
}

/** A number, or null for blank or unreadable text. */
export function numberOrNull(value) {
  const text = String(value).trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** The weight_log row saved from the form. */
export const weightRow = (entry) => ({
  date: entry.date,
  week: numberOrNull(entry.week),
  dose: String(entry.dose).trim(),
  projected: numberOrNull(entry.projected),
  actual: numberOrNull(entry.actual),
});

const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");

/** The log with the row added or replaced, in date order. */
export const withWeightRow = (log, row) =>
  [...log.filter((r) => r.date !== row.date), row].sort(byDate);

export const withoutWeightRow = (log, date) => log.filter((r) => r.date !== date);
