// tests/appleActivityView.test.mjs — src/lib/appleActivity.js: what the Apple Watch card shows (Fix 77)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityRows,
  anyExcluded,
  hasActivityData,
  polarIdsOf,
  statusText,
  summaryText,
  syncedAt,
} from "../src/lib/appleActivity.js";

test("polarIdsOf: the Polar session ids of the day's workout items, in order", () => {
  const day = {
    meals: [
      { items: [{ polar_session_id: "p1" }, { name: "Toast" }, { polar_session_id: "p2" }] },
      { items: [{ polar_session_id: "" }, { polar_session_id: null }] },
      { name: "no items" },
      { items: [{ polar_session_id: "p3" }] },
    ],
  };
  assert.deepEqual(polarIdsOf(day), ["p1", "p2", "p3"]);
  assert.deepEqual(polarIdsOf({}), []);
  assert.deepEqual(polarIdsOf(null), []);
  assert.deepEqual(polarIdsOf({ meals: [] }), []);
});

test("hasActivityData: slots with an entry, or daily totals", () => {
  assert.equal(hasActivityData({ slots: { "08:00": { steps: 5 } } }), true);
  assert.equal(hasActivityData({ slots: {} }), false);
  assert.equal(hasActivityData({ totals: { steps: 0 } }), true);
  assert.equal(hasActivityData({ slots: {}, totals: { steps: 1 } }), true);
  assert.equal(hasActivityData({}), false);
  assert.equal(hasActivityData(null), false);
  assert.equal(hasActivityData(undefined), false);
});

test("syncedAt: HH:MM of the local time, or null", () => {
  assert.equal(syncedAt(new Date(2026, 9, 4, 9, 5, 0).toISOString()), "09:05");
  assert.equal(syncedAt(new Date(2026, 9, 4, 23, 30, 0).toISOString()), "23:30");
  assert.equal(syncedAt(null), null);
  assert.equal(syncedAt(undefined), null);
  assert.equal(syncedAt(""), null);
});

test("activityRows: label, count and kcal for steps, active minutes and flights", () => {
  const a = {
    steps: 12345,
    activeMin: 42,
    flights: 7,
    kcal: { steps: 300, active: 120, flights: 15 },
  };
  assert.deepEqual(activityRows(a), [
    ["Steps", (12345).toLocaleString(), 300],
    ["Active minutes", "42 min", 120],
    ["Flights climbed", 7, 15],
  ]);
});

test("anyExcluded: true when any of the three counts is above zero", () => {
  assert.equal(anyExcluded({ steps: 0, activeMin: 0, flights: 0 }), false);
  assert.equal(anyExcluded({ steps: 1, activeMin: 0, flights: 0 }), true);
  assert.equal(anyExcluded({ steps: 0, activeMin: 5, flights: 0 }), true);
  assert.equal(anyExcluded({ steps: 0, activeMin: 0, flights: 2 }), true);
});

test("statusText: loading wins, then the synced time, else nothing", () => {
  assert.equal(statusText(true, "09:05"), "loading…");
  assert.equal(statusText(true, null), "loading…");
  assert.equal(statusText(false, "09:05"), "synced 09:05");
  assert.equal(statusText(false, null), "");
});

test("summaryText: steps and total kcal when there is data, a dash when not", () => {
  const a = { steps: 8000, kcal: { total: 250 } };
  assert.equal(summaryText(true, a), `${(8000).toLocaleString()} steps · 250 kcal`);
  assert.equal(summaryText(false, a), "—");
});
