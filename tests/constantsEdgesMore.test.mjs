// tests/constantsEdgesMore.test.mjs — edge cases in src/constants/helpers.js and weightPlan.js that
// the mutation runs showed no test guarded (Fix 81); meds and recipeLinks are in constantsEdges.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_LEVELS,
  calcAppleActivity,
  ensureMealSlots,
  formatDate,
  parseDurationMin,
} from "../src/constants/helpers.js";
import {
  DEFAULT_PLAN_CONFIG,
  cmPerKgAt,
  deriveMilestones,
  planAnchorPoints,
  projectedWeightAt,
  waistForWeight,
} from "../src/constants/weightPlan.js";

// Runs fn with the process in another time zone (Node re-reads TZ when it is assigned).
const inTimeZone = (zone, fn) => {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
};

// ---- helpers.js
test("helpers: the five activity levels and their factors", () => {
  assert.deepEqual(ACTIVITY_LEVELS, [
    { label: "Sedentary", desc: "Desk job, little/no exercise", factor: 1.2 },
    { label: "Lightly Active", desc: "Light exercise 1–3×/week", factor: 1.375 },
    { label: "Moderately Active", desc: "Moderate exercise 3–5×/week", factor: 1.55 },
    { label: "Very Active", desc: "Hard exercise 6–7×/week", factor: 1.725 },
    { label: "Extremely Active", desc: "Physical job + hard training", factor: 1.9 },
  ]);
});

test("helpers: formatDate shows the same day in a time zone behind UTC", () => {
  assert.match(
    inTimeZone("America/Los_Angeles", () => formatDate("2026-10-04")),
    /^Sun,? 4 Oct 2026$/,
  );
});

test("helpers: ensureMealSlots keeps the default slots in order and custom meals after them", () => {
  const day = { date: "2026-10-04", meals: [{ name: "Zeta snack" }, { name: "Alpha snack" }] };
  const names = ensureMealSlots(day).meals.map((m) => m.name);
  const custom = names.slice(-2);
  assert.deepEqual(custom, ["Zeta snack", "Alpha snack"]); // their own order, after the defaults
  assert.ok(names.length > 2);
  const defaults = names.slice(0, -2);
  const dayWithAll = ensureMealSlots({ meals: defaults.map((name) => ({ name })) }).meals;
  assert.deepEqual(
    dayWithAll.map((m) => m.name),
    defaults,
  );
});

test("helpers: parseDurationMin reads hours, minutes and fractional seconds", () => {
  assert.equal(parseDurationMin("PT10H15M30.5S"), 10 * 60 + 15 + 30.5 / 60);
  assert.equal(parseDurationMin("PT1H"), 60);
  assert.equal(parseDurationMin("PT45M"), 45);
  assert.equal(parseDurationMin("PT0M12.25S"), 12.25 / 60);
  assert.equal(parseDurationMin(""), 0);
  assert.equal(parseDurationMin(undefined), 0);
});

test("helpers: calcAppleActivity copes with a missing Polar session in the list", () => {
  const activity = { slots: { "0800": [100, 1, 0], "0805": [50, 1, 0] } };
  const out = calcAppleActivity(activity, [
    null,
    { start_time: "2026-10-04T08:00:00", duration_min: 30 },
  ]);
  assert.equal(typeof out.steps, "number");
  assert.deepEqual(Object.keys(out.excluded), ["steps", "activeMin", "flights"]);
});

// ---- weightPlan.js
const PLAN = {
  startDate: "2026-08-16",
  startWeightKg: 84,
  planAnchors: [{ week: 2, weightKg: 80 }],
  targetWeightMinKg: 70,
  targetWeightMaxKg: 72,
  startWaistCm: 100,
  cmPerKgStart: 2,
  cmPerKgEnd: 1,
};

test("weightPlan: the default plan is for a man", () => {
  assert.equal(DEFAULT_PLAN_CONFIG.sex, "m");
});

test("weightPlan: no plan without a config; anchors at week 0 or off the plan are ignored", () => {
  assert.deepEqual(planAnchorPoints(undefined), []);
  assert.deepEqual(planAnchorPoints(null), []);
  assert.deepEqual(planAnchorPoints({ startDate: "x", startWeightKg: 80 }), []);
  assert.deepEqual(planAnchorPoints({ startDate: "2026-08-16", startWeightKg: "kg" }), []);
  const cfg = {
    startDate: "2026-08-16",
    startWeightKg: 84,
    planAnchors: [
      { week: 0, weightKg: 99 },
      { week: -1, weightKg: 1 },
      { week: "x", weightKg: 1 },
      { week: 3 },
    ],
  };
  assert.deepEqual(
    planAnchorPoints(cfg).map((p) => [p.week, p.weightKg]),
    [[0, 84]],
  );
});

test("weightPlan: a date with a time is read as its day; outside the curve there is no weight", () => {
  assert.equal(projectedWeightAt(PLAN, "2026-08-23T10:00:00Z"), 82);
  assert.equal(projectedWeightAt(PLAN, "2026-08-23"), 82);
  assert.equal(projectedWeightAt(PLAN, "2026-08-15"), null); // before the start
  assert.equal(projectedWeightAt(PLAN, "2026-08-31"), null); // after the last anchor
  assert.equal(projectedWeightAt(PLAN, "not a date"), null);
  assert.equal(
    projectedWeightAt({ startDate: "2026-08-16", startWeightKg: 84 }, "2026-08-16"),
    null,
  );
});

test("weightPlan: cm per kg needs a plan, both rates and a weight; equal start and end weights give the end rate", () => {
  assert.equal(cmPerKgAt(null, 82), null);
  assert.equal(cmPerKgAt({ ...PLAN, planAnchors: [] }, 82), null); // one point is not a curve
  assert.equal(cmPerKgAt({ ...PLAN, cmPerKgStart: undefined }, 82), null);
  assert.equal(cmPerKgAt({ ...PLAN, cmPerKgEnd: undefined }, 82), null);
  assert.equal(cmPerKgAt(PLAN, NaN), null);
  assert.equal(cmPerKgAt(PLAN, 82), 1.5); // half way: between 2 and 1
  assert.equal(cmPerKgAt({ ...PLAN, planAnchors: [{ week: 2, weightKg: 84 }] }, 84), 1); // flat plan: the end rate
});

test("weightPlan: waist follows weight along the plan, and is null when the plan can't say", () => {
  assert.equal(waistForWeight(null, 82), null);
  assert.equal(waistForWeight({ ...PLAN, planAnchors: [] }, 82), null);
  assert.equal(waistForWeight({ ...PLAN, startWaistCm: undefined }, 82), null);
  assert.equal(waistForWeight(PLAN, NaN), null);
  assert.equal(
    waistForWeight({ ...PLAN, cmPerKgStart: undefined, cmPerKgEnd: undefined }, 82),
    null,
  );
  assert.equal(waistForWeight(PLAN, 84), 100);
  assert.equal(waistForWeight(PLAN, 82), 96.5); // 2 kg lost x mean of 2 and 1.5 cm per kg = 3.5 cm
});

test("weightPlan: a milestone is reached when the plan hits its weight exactly", () => {
  // 84 -> 80 over two weeks: -4 kg is reached exactly at week 2, the end of the plan
  const notes = deriveMilestones(PLAN).map((m) => m.note);
  assert.deepEqual(notes, ["START", "-4 kg", "Plan end, wk 2"]);
  assert.deepEqual(deriveMilestones(null), []);
});
