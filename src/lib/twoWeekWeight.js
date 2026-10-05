// src/lib/twoWeekWeight.js — smoothed weight over calendar weeks (Mon–Sun), for the Weight tab's
// 2-wk avg line and 2-wk Loss column. Averaging blocks of readings cancels the day-to-day water
// swings that a reading-to-reading difference would carry.

/** Rows with a date and a numeric reading. */
export const weightReadings = (weightLog) =>
  weightLog.filter((row) => row?.date && row.actual != null && Number.isFinite(Number(row.actual)));

/** Monday (UTC midnight) of the week a "YYYY-MM-DD" date falls in; null for a bad date. */
function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d)) return null;
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/** "YYYY-MM-DD" n days before a date. */
function isoMinusDays(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() - n);
  return x.toISOString().slice(0, 10);
}

/** Mean of the readings dated from–to (inclusive); null when there are none. */
function meanBetween(readings, from, to) {
  const xs = readings
    .filter((row) => row.date >= from && row.date <= to)
    .map((row) => Number(row.actual));
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

/** Smoothed weight on a date: mean of the readings from the previous week's Monday to that date. */
export function twoWeekAvgAt(readings, dateStr) {
  const mon = mondayOf(dateStr);
  return mon ? meanBetween(readings, isoMinusDays(mon, 7), dateStr) : null;
}

/**
 * A row's 2-week loss ("0.8"; negative = gain): mean of the 2 calendar weeks before the row's
 * 2 weeks, minus the mean of its own 2 weeks (to the row's date). Null without both.
 */
export function twoWeekLossAt(readings, row) {
  if (!row?.date || row.actual == null) return null;
  const mon = mondayOf(row.date);
  if (!mon) return null;
  const recent = meanBetween(readings, isoMinusDays(mon, 7), row.date);
  const prior = meanBetween(readings, isoMinusDays(mon, 21), isoMinusDays(mon, 8));
  if (recent == null || prior == null) return null;
  return (prior - recent).toFixed(1);
}
