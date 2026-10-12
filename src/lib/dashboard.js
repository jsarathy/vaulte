// src/lib/dashboard.js — the Dashboard's User Apps rows (Fix 98): how long ago each app last gave
// Vaulte data, and whether that is fresh, stale or missing. Times and dates are the viewer's.

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Milliseconds since an ISO time, or since the start of a "YYYY-MM-DD" day; null if unknown. */
export function ageMs(value, now = new Date()) {
  const m = DATE_ONLY.exec(String(value ?? ""));
  const at = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  if (!value || Number.isNaN(at.getTime())) return null;
  return Math.max(0, now.getTime() - at.getTime());
}

const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago"; a plain date: "today", "yesterday", "3 days ago". */
export function ago(value, now = new Date()) {
  const age = ageMs(value, now);
  if (age == null) return "";
  if (DATE_ONLY.test(value)) {
    const days = Math.floor(age / DAY);
    return days === 0 ? "today" : days === 1 ? "yesterday" : plural(days, "day");
  }
  if (age < MIN) return "just now";
  if (age < HOUR) return plural(Math.floor(age / MIN), "minute");
  if (age < DAY) return plural(Math.floor(age / HOUR), "hour");
  return plural(Math.floor(age / DAY), "day");
}

/** How long each app may go without data before it counts as stale. */
export const MAX_AGE_HOURS = { polar: 48, apple: 36, weight: 7 * 24, body: 30 * 24 };

const row = (id, name, state, text) => ({ id, name, state, text });
const fresh = (value, hours, now) => {
  const age = ageMs(value, now);
  return age != null && age <= hours * HOUR ? "ok" : "stale";
};
const failed = (x) => x?.failed === true;

function polarRow(polar, now) {
  if (failed(polar)) return row("polar", "Polar", "error", "Could not read");
  if (!polar?.connected) return row("polar", "Polar", "never", "Not connected");
  if (!polar.last_sync_at) return row("polar", "Polar", "never", "Connected, not synced yet");
  const state = fresh(polar.last_sync_at, MAX_AGE_HOURS.polar, now);
  return row("polar", "Polar", state, `Last sync ${ago(polar.last_sync_at, now)}`);
}

function readingRow(app, last, now) {
  const { id, name, empty, label } = app;
  if (failed(last)) return row(id, name, "error", "Could not read");
  if (!last) return row(id, name, "never", empty);
  const when = last.updated_at || last.date;
  return row(id, name, fresh(when, MAX_AGE_HOURS[id], now), `${label} ${ago(when, now)}`);
}

const APPLE = { id: "apple", name: "Apple Health", empty: "No data received", label: "Last data" };
const SCALE = { id: "weight", name: "Renpho scale", empty: "No readings", label: "Last reading" };
const TAPE = {
  id: "body",
  name: "Renpho tape measure",
  empty: "No readings",
  label: "Last reading",
};

/**
 * The rows: Polar, Apple Health (Shortcuts), Renpho scale and tape measure. Each input is null when
 * the app has never given data, { failed: true } when it could not be read.
 * data = { polar: { connected, last_sync_at }, apple: { updated_at }, weight: { date }, body: { date } }
 */
export function dashboardRows(data, now = new Date()) {
  return [
    polarRow(data.polar, now),
    readingRow(APPLE, data.apple, now),
    readingRow(SCALE, data.weight, now),
    readingRow(TAPE, data.body, now),
  ];
}
