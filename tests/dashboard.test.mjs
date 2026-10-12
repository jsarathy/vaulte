// tests/dashboard.test.mjs — the Dashboard's User Apps rows (src/lib/dashboard.js, Fix 98): how long
// ago each app gave data and whether that is fresh, stale or missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_AGE_HOURS, ageMs, ago, dashboardRows } from "../src/lib/dashboard.js";

const NOW = new Date(2026, 9, 11, 12, 0, 0); // 11 Oct 2026, 12:00 local
const minus = (ms) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("ageMs: since an ISO time, or since the start of a day; null when unknown", () => {
  assert.equal(ageMs(minus(5 * MIN), NOW), 5 * MIN);
  assert.equal(ageMs("2026-10-11", NOW), 12 * HOUR); // since 00:00 local
  assert.equal(ageMs("2026-10-09", NOW), 2 * DAY + 12 * HOUR);
  assert.equal(ageMs(new Date(NOW.getTime() + HOUR).toISOString(), NOW), 0); // never negative
  assert.equal(ageMs("", NOW), null);
  assert.equal(ageMs(null, NOW), null);
  assert.equal(ageMs(undefined, NOW), null);
  assert.equal(ageMs("not a date", NOW), null);
  assert.ok(ageMs(minus(1000)) >= 0); // no 'now' given: the real time
});

test("ago: minutes, hours and days; singular and plural", () => {
  assert.equal(ago(minus(10_000), NOW), "just now");
  assert.equal(ago(minus(59_999), NOW), "just now");
  assert.equal(ago(minus(MIN), NOW), "1 minute ago");
  assert.equal(ago(minus(5 * MIN), NOW), "5 minutes ago");
  assert.equal(ago(minus(59 * MIN), NOW), "59 minutes ago");
  assert.equal(ago(minus(HOUR), NOW), "1 hour ago");
  assert.equal(ago(minus(3 * HOUR + 40 * MIN), NOW), "3 hours ago");
  assert.equal(ago(minus(23 * HOUR + 59 * MIN), NOW), "23 hours ago");
  assert.equal(ago(minus(DAY), NOW), "1 day ago");
  assert.equal(ago(minus(2 * DAY + 5 * HOUR), NOW), "2 days ago");
  assert.equal(ago("", NOW), "");
  assert.equal(ago(undefined, NOW), "");
});

test("ago: a plain date is today, yesterday or N days ago", () => {
  assert.equal(ago("2026-10-11", NOW), "today");
  assert.equal(ago("2026-10-10", NOW), "yesterday");
  assert.equal(ago("2026-10-09", NOW), "2 days ago");
  assert.equal(ago("2026-10-01", NOW), "10 days ago");
  assert.equal(ago("2026-10-12", NOW), "today"); // a date ahead is not 'in the future'
});

test("MAX_AGE_HOURS: how long each app may be quiet", () => {
  assert.deepEqual(MAX_AGE_HOURS, { polar: 48, apple: 36, weight: 168, body: 720 });
});

const FRESH = {
  polar: { connected: true, last_sync_at: minus(2 * HOUR) },
  apple: { updated_at: minus(3 * HOUR) },
  weight: { date: "2026-10-10" },
  body: { date: "2026-10-01" },
};

test("dashboardRows: everything fresh", () => {
  assert.deepEqual(dashboardRows(FRESH, NOW), [
    { id: "polar", name: "Polar", state: "ok", text: "Last sync 2 hours ago" },
    { id: "apple", name: "Apple Health", state: "ok", text: "Last data 3 hours ago" },
    { id: "weight", name: "Renpho scale", state: "ok", text: "Last reading yesterday" },
    { id: "body", name: "Renpho tape measure", state: "ok", text: "Last reading 10 days ago" },
  ]);
});

test("dashboardRows: stale at each app's limit, fresh just inside it", () => {
  const state = (key, value, id) =>
    dashboardRows({ ...FRESH, [key]: value }, NOW).find((r) => r.id === id).state;
  const polar = (h) => ({ connected: true, last_sync_at: minus(h * HOUR) });
  assert.equal(state("polar", polar(48), "polar"), "ok");
  assert.equal(state("polar", polar(48.1), "polar"), "stale");
  assert.equal(state("apple", { updated_at: minus(36 * HOUR) }, "apple"), "ok");
  assert.equal(state("apple", { updated_at: minus(37 * HOUR) }, "apple"), "stale");
  assert.equal(state("weight", { date: "2026-10-05" }, "weight"), "ok"); // 6 days and 12 h
  assert.equal(state("weight", { date: "2026-10-04" }, "weight"), "stale"); // 7 days and 12 h
  assert.equal(state("body", { date: "2026-09-12" }, "body"), "ok"); // 29 days and 12 h
  assert.equal(state("body", { date: "2026-09-11" }, "body"), "stale"); // 30 days and 12 h
});

test("dashboardRows: Polar not connected, never synced; the others with no data", () => {
  const rows = dashboardRows(
    {
      polar: { connected: false, last_sync_at: minus(HOUR) },
      apple: null,
      weight: null,
      body: null,
    },
    NOW,
  );
  assert.deepEqual(rows, [
    { id: "polar", name: "Polar", state: "never", text: "Not connected" },
    { id: "apple", name: "Apple Health", state: "never", text: "No data received" },
    { id: "weight", name: "Renpho scale", state: "never", text: "No readings" },
    { id: "body", name: "Renpho tape measure", state: "never", text: "No readings" },
  ]);
  assert.equal(dashboardRows({ ...FRESH, polar: null }, NOW)[0].text, "Not connected");
  assert.deepEqual(
    dashboardRows({ ...FRESH, polar: { connected: true, last_sync_at: null } }, NOW)[0],
    { id: "polar", name: "Polar", state: "never", text: "Connected, not synced yet" },
  );
});

test("dashboardRows: an app that could not be read is an error row; the others still show", () => {
  const rows = dashboardRows(
    {
      polar: { failed: true },
      apple: { failed: true },
      weight: { failed: true },
      body: FRESH.body,
    },
    NOW,
  );
  assert.deepEqual(
    rows.map((r) => [r.id, r.name, r.state, r.text]),
    [
      ["polar", "Polar", "error", "Could not read"],
      ["apple", "Apple Health", "error", "Could not read"],
      ["weight", "Renpho scale", "error", "Could not read"],
      ["body", "Renpho tape measure", "ok", "Last reading 10 days ago"],
    ],
  );
});

test("dashboardRows: Apple prefers its update time; a reading with neither is stale", () => {
  assert.equal(
    dashboardRows({ ...FRESH, apple: { updated_at: minus(HOUR), date: "2020-01-01" } }, NOW)[1]
      .state,
    "ok",
  );
  assert.equal(dashboardRows({ ...FRESH, weight: {} }, NOW)[2].state, "stale");
  assert.ok(dashboardRows(FRESH).length === 4); // no 'now' given
});
