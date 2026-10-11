// tests/libEdgesMore.test.mjs — more src/lib edge cases the mutation runs showed no test guarded
// (Fix 79); the first batch is in tests/libEdges.test.mjs. One section per module.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mealSlotOptions } from "../src/lib/exerciseLog.js";
import { LOOKUP_UNITS, isDish, parseLookupReply } from "../src/lib/foodLookup.js";
import { mealSummary } from "../src/lib/mealCards.js";
import { PHOTO_ERROR, parsePhotoReply } from "../src/lib/photoLog.js";
import { ZONES, heartRateChart } from "../src/lib/polarHeartRate.js";
import { matchesSearch } from "../src/lib/polarSessions.js";
import { nutritionKey } from "../src/lib/recipeBuilder.js";
import { hasEntries } from "../src/lib/trackerDays.js";
import { twoWeekLossAt } from "../src/lib/twoWeekWeight.js";
import { chartLayout, chartSeries, hoverLabel, xTicks, yAxis } from "../src/lib/trajectoryChart.js";

// ---- exerciseLog.js
test("exerciseLog: mealSlotOptions offers the default slots for a date that has no saved day", () => {
  const defaults = mealSlotOptions([], "2026-10-04");
  const other = [{ date: "2026-10-01", meals: [{ id: "x1", name: "Only meal" }] }];
  assert.deepEqual(mealSlotOptions(other, "2026-10-04"), defaults);
  assert.ok(mealSlotOptions(other, "2026-10-01").some((o) => o.label === "Only meal"));
});

// ---- foodLookup.js
test("foodLookup: the seven units and their labels", () => {
  assert.deepEqual(LOOKUP_UNITS, [
    ["portion", "portion(s)"],
    ["g", "grams (g)"],
    ["ml", "millilitres (ml)"],
    ["oz", "ounces (oz)"],
    ["cup", "cup(s)"],
    ["tbsp", "tablespoon(s)"],
    ["tsp", "teaspoon(s)"],
  ]);
});

test("foodLookup: a reply with no text is an empty object; a DISH reply is a dish in any case", () => {
  assert.deepEqual(parseLookupReply({}), {});
  assert.deepEqual(parseLookupReply({ content: [] }), {});
  assert.deepEqual(parseLookupReply({ content: [{ text: '```json\n{"kcal": 5}\n```' }] }), {
    kcal: 5,
  });
  assert.equal(isDish({ kind: "DISH" }), true);
  assert.equal(isDish({ kind: "dish" }), true);
  assert.equal(isDish({ kind: "INGREDIENT" }), false);
  assert.equal(isDish({}), false);
});

// ---- mealCards.js
test("mealCards: a card is a workout when any one of its entries is", () => {
  const items = [{ name: "Toast" }, { name: "Run", is_exercise: 1 }, { name: "Tea" }];
  assert.equal(Boolean(mealSummary({ items }).isExercise), true);
  assert.equal(Boolean(mealSummary({ items: [{ name: "Toast" }] }).isExercise), false);
  assert.equal(Boolean(mealSummary({ is_exercise: 1, items: [] }).isExercise), true);
});

// ---- photoLog.js
test("photoLog: the error text; an empty reply is an empty list; an unclosed fence still parses", () => {
  assert.equal(PHOTO_ERROR, "Could not analyse photo. Try a clearer image or add items manually.");
  assert.deepEqual(parsePhotoReply({}), []);
  assert.deepEqual(parsePhotoReply({ content: [] }), []);
  const unclosed = { content: [{ text: '```json\n[{"name":"a"}]' }] };
  assert.deepEqual(parsePhotoReply(unclosed), [{ name: "a" }]);
});

test("photoLog: only a leading 'json' is removed after the fence", () => {
  const text = '```\n[{"name":"json"}]\n```';
  assert.deepEqual(parsePhotoReply({ content: [{ text }] }), [{ name: "json" }]);
});

// ---- polarHeartRate.js
test("polarHeartRate: the five zones; two readings are enough for a chart, one is not", () => {
  assert.deepEqual(
    ZONES.map((z) => [z.label, z.color]),
    [
      ["Z1", "#B5D4F4"],
      ["Z2", "#C0DD97"],
      ["Z3", "#FAC775"],
      ["Z4", "#F0997B"],
      ["Z5", "#E24B4A"],
    ],
  );
  assert.equal(heartRateChart({ hr_samples: [100] }), null);
  assert.equal(heartRateChart({ hr_samples: [] }), null);
  const two = heartRateChart({ hr_samples: [100, 120] });
  assert.equal(two.low, 100);
  assert.equal(two.high, 120);
  assert.equal(two.points.split(" ").length, 2);
});

// ---- polarSessions.js
test("polarSessions: search never matches text that is not in the session", () => {
  const none = { id: "p1" };
  assert.equal(matchesSearch(none, "stryker"), false);
  assert.equal(matchesSearch(none, "was here"), false);
  assert.equal(matchesSearch(none, "ryker"), false);
  assert.equal(matchesSearch(none, ""), true);
  const run = { id: "p2", sport: "RUNNING", start_time: "2026-10-04T09:05:00" };
  assert.equal(matchesSearch(run, "09:05"), false); // only the date part of the time is searched
  assert.equal(matchesSearch(run, "2026-10-04"), true);
  assert.equal(matchesSearch(run, "run"), true);
  assert.equal(matchesSearch(run, "4 oct"), true);
});

// ---- recipeBuilder.js
test("recipeBuilder: nutritionKey with no ingredients, and rows that are only half filled in", () => {
  assert.equal(nutritionKey({ servings: 2 }), '{"s":2,"i":[]}');
  assert.equal(nutritionKey(undefined), '{"s":0,"i":[]}');
  const key = nutritionKey({
    servings: 1,
    ingredients: [
      { amount: "100g", item: "" },
      { amount: "", item: "salt" },
      { amount: " ", item: " " },
    ],
  });
  assert.equal(key, '{"s":1,"i":[["100g",""],["","salt"]]}');
});

// ---- trackerDays.js
test("trackerDays: a day has entries when any meal has an item; a meal without items is fine", () => {
  assert.equal(hasEntries({ meals: [{ name: "B" }, { name: "L", items: [{ id: 1 }] }] }), true);
  assert.equal(hasEntries({ meals: [{ name: "B" }, { items: [] }] }), false);
  assert.equal(hasEntries({ meals: [{ items: [{ id: 1 }] }, { items: [] }] }), true);
  assert.equal(hasEntries({}), false);
  assert.equal(hasEntries(null), false);
});

// ---- twoWeekWeight.js
test("twoWeekWeight: no loss without readings in the row's own two weeks", () => {
  const readings = [{ date: "2026-09-20", actual: 90 }];
  assert.equal(twoWeekLossAt(readings, { date: "2026-10-07", actual: 88 }), null);
  const own = [{ date: "2026-10-06", actual: 88 }];
  assert.equal(twoWeekLossAt(own, { date: "2026-10-07", actual: 88 }), null);
});

// ---- trajectoryChart.js
const PLAN = {
  startDate: "2026-08-16",
  startWeightKg: 84,
  planAnchors: [{ week: 2, weightKg: 82 }],
  targetWeightMinKg: 70,
  targetWeightMaxKg: 72,
};
const LOG = [
  { date: "2026-08-20", actual: 83.5 },
  { date: "2026-08-18", actual: 83.9 },
];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const withWindow = (fn) => {
  globalThis.window = { innerWidth: 1000, innerHeight: 800 };
  try {
    return fn();
  } finally {
    delete globalThis.window;
  }
};

test("trajectoryChart: the time span runs from the plan's first point to its last", () => {
  const series = chartSeries(LOG, "weight", PLAN);
  const L = chartLayout(series, PLAN, { full: false, box: {} });
  assert.equal(L.tMin, series.projPts[0].t);
  assert.equal(L.tMax, series.projPts[series.projPts.length - 1].t);
  assert.equal(L.span, L.tMax - L.tMin);
});

test("trajectoryChart: expanded, the padding and dots are 1.6 times the compact size", () => {
  const series = chartSeries(LOG, "weight", PLAN);
  const L = chartLayout(series, PLAN, { full: true, box: { w: 3000, h: 900 } });
  near(L.k, 1.6);
  near(L.PAD.top, 19.2);
  near(L.PAD.right, 25.6);
  near(L.PAD.bottom, 80);
  near(L.PAD.left, 64);
  near(L.r, 4.8); // 3 x 1.6: a wide chart has room for full-size dots
  near(L.actSW, 3.36); // 70% of r, under 2.5 x 1.6
  const c = chartLayout(series, PLAN, { full: false, box: {} });
  near(c.PAD.top, 12);
  near(c.r, 3);
});

test("trajectoryChart: expanded with no measured area, the drawing follows the window", () => {
  const series = chartSeries(LOG, "weight", PLAN);
  const L = withWindow(() => chartLayout(series, PLAN, { full: true, box: {} }));
  assert.equal(L.W, 952); // 1000 - 48
  assert.equal(L.H, 628); // 800 - 150 - 22
  const noWindow = chartLayout(series, PLAN, { full: true, box: {} });
  assert.equal(noWindow.W, 1200);
  assert.equal(noWindow.H, 578); // 600 - 22
});

test("trajectoryChart: yAxis says how many decimals its labels need", () => {
  assert.deepEqual(yAxis({ minW: 0, maxW: 30, full: false }), {
    ticks: [0, 5, 10, 15, 20, 25, 30],
    dec: 0,
  });
  assert.deepEqual(yAxis({ minW: 0, maxW: 15, full: false }), {
    ticks: [0, 2.5, 5, 7.5, 10, 12.5, 15],
    dec: 1,
  });
  assert.equal(yAxis({ minW: 0, maxW: 1.5, full: false }).dec, 2);
});

test("trajectoryChart: a date step that fits exactly is used (22 px a day, 10 px text, daily)", () => {
  const DAY = 86400000;
  assert.deepEqual(xTicks({ tMin: 0, tMax: 3 * DAY, dayPx: 22, fs: 10 }), [
    0,
    DAY,
    2 * DAY,
    3 * DAY,
  ]);
});

test("trajectoryChart: the hover label shows the 2-wk average only for a point that has one", () => {
  const avgPts = [{ t: 9, v: 81.234 }];
  assert.doesNotMatch(hoverLabel({ t: 5, v: 80 }, { unit: "kg", avgPts }), /2-wk avg/);
  assert.match(hoverLabel({ t: 9, v: 80 }, { unit: "kg", avgPts }), /80\.0 kg · 2-wk avg 81\.2$/);
});
