// tests/appleActivity.test.mjs — Apple Watch activity and its kcal estimate (Fix 3/4, kept for Fix 26)
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcAppleActivity } from "../src/constants/helpers.js";

const run = (start, mins) => ({
  start_time: `2026-10-04T${start}:00`,
  duration_min: mins,
  sport: "RUNNING",
});

test("no data → all zeros", () => {
  assert.deepEqual(calcAppleActivity({}), calcAppleActivity(null));
  const a = calcAppleActivity(null);
  assert.deepEqual(a, {
    steps: 0,
    activeMin: 0,
    flights: 0,
    excluded: { steps: 0, activeMin: 0, flights: 0 },
    kcal: { steps: 0, active: 0, flights: 0, total: 0 },
  });
});

test("kcal: steps, active minutes and flights at 70 kg; total rounded once", () => {
  const a = calcAppleActivity({ slots: { 1000: [1000, 10, 2] } }, [], 70);
  assert.deepEqual(a.kcal, { steps: 40, active: 18, flights: 4, total: 61 }); // 39.9 + 17.5 + 3.94
  assert.equal(a.steps, 1000);
  assert.equal(a.activeMin, 10);
  assert.equal(a.flights, 2);
});

test("missing or zero weight uses 84 kg", () => {
  assert.equal(calcAppleActivity({ slots: { 1000: [1000, 0, 0] } }, [], 0).kcal.steps, 48); // 47.88
  assert.equal(calcAppleActivity({ slots: { 1000: [1000, 0, 0] } }).kcal.steps, 48);
});

test("5-min slots overlapping a Polar session are excluded pro rata", () => {
  const a = calcAppleActivity(
    { slots: { "0800": [100, 2, 1], "0805": [50, 1, 0] } },
    [run("08:02", 30)],
    70,
  );
  assert.deepEqual(
    { steps: a.steps, activeMin: a.activeMin, flights: a.flights },
    { steps: 40, activeMin: 1, flights: 0 },
  );
  assert.deepEqual(a.excluded, { steps: 110, activeMin: 2, flights: 1 });
});

test("slot outside every session, or a session with no start time, is kept", () => {
  const sessions = [run("09:00", 10), { duration_min: 60, sport: "RUNNING" }];
  const a = calcAppleActivity({ slots: { "0800": [100, 2, 1], "0910": [30, 0, 0] } }, sessions, 70);
  assert.equal(a.steps, 130);
  assert.deepEqual(a.excluded, { steps: 0, activeMin: 0, flights: 0 });
});

test("empty slot value counts as zero", () => {
  assert.equal(calcAppleActivity({ slots: { "0800": null, "0805": [5] } }, [], 70).steps, 5);
});

test("daily totals: Polar time removed using the sport's cadence", () => {
  const sessions = [
    { start_time: "x", duration_min: 30, sport: "RUNNING" },
    { duration_min: 20, sport: "CYCLING" },
  ];
  const a = calcAppleActivity(
    { totals: { steps: 10000, activeMin: 60, flights: 5 } },
    sessions,
    70,
  );
  assert.deepEqual(
    { steps: a.steps, activeMin: a.activeMin, flights: a.flights },
    { steps: 5200, activeMin: 10, flights: 5 },
  );
  assert.deepEqual(a.excluded, { steps: 4800, activeMin: 50, flights: 0 });
  assert.deepEqual(a.kcal, { steps: 207, active: 18, flights: 10, total: 235 });
});

test("daily totals: cadence per sport (walk 110, hike 100, other 0)", () => {
  const steps = (sport) =>
    calcAppleActivity({ totals: { steps: 5000 } }, [{ duration_min: 10, sport }], 70).excluded
      .steps;
  assert.equal(steps("Walking"), 1100);
  assert.equal(steps("HIKING"), 1000);
  assert.equal(steps("JOGGING"), 1600);
  assert.equal(steps("STRENGTH_TRAINING"), 0);
  assert.equal(
    calcAppleActivity({ totals: { steps: 5 } }, [{ duration_min: 10 }], 70).excluded.steps,
    0,
  );
});

test("daily totals: exclusion never exceeds what was recorded; missing fields are 0", () => {
  const a = calcAppleActivity({ totals: { steps: 1000 } }, [run("08:00", 60)], 70);
  assert.equal(a.steps, 0);
  assert.equal(a.excluded.steps, 1000);
  assert.equal(a.activeMin, 0);
  assert.equal(a.flights, 0);
});

test("slots win over totals; empty slots fall back to totals", () => {
  const totals = { steps: 9000, activeMin: 0, flights: 0 };
  assert.equal(calcAppleActivity({ slots: { 1000: [100, 0, 0] }, totals }, [], 70).steps, 100);
  assert.equal(calcAppleActivity({ slots: {}, totals }, [], 70).steps, 9000);
});
