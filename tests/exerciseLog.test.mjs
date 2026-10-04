// tests/exerciseLog.test.mjs — manual exercise estimate and logging (Fix 26 PR 11)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEIGHT_KG,
  filterExercises,
  exerciseEstimate,
  estimateTiles,
  exerciseItem,
  mealSlotOptions,
  mealIdIn,
  withItemInMeal,
} from "../src/lib/exerciseLog.js";
import { DEFAULT_MEAL_SLOTS } from "../src/constants/helpers.js";

const RUN = { cat: "Cardio", name: "Running, moderate (6 mph)", met: 9.8 };
const YOGA = { cat: "Flexibility", name: "Yoga, Hatha", met: 2.5 };

test("filter by name or category, any case; blank → all", () => {
  assert.deepEqual(filterExercises([RUN, YOGA], ""), [RUN, YOGA]);
  assert.deepEqual(filterExercises([RUN, YOGA], "RUNNING"), [RUN]);
  assert.deepEqual(filterExercises([RUN, YOGA], "flex"), [YOGA]);
  assert.deepEqual(filterExercises([RUN, YOGA], "swim"), []);
});

test("estimate needs an exercise and a duration", () => {
  assert.equal(exerciseEstimate(null, { durationText: "30", hrText: "" }), null);
  assert.equal(exerciseEstimate(RUN, { durationText: "", hrText: "" }), null);
  assert.equal(exerciseEstimate(RUN, { durationText: "abc", hrText: "" }).kcal, 0);
});

test("estimate without HR: 70% of max → Zone 3, 60% fat", () => {
  assert.deepEqual(exerciseEstimate(RUN, { durationText: "45", hrText: "" }), {
    kcal: 617, // 9.8 × 84 × 45/60 = 617.4
    fatPct: 60,
    fatKcal: 370,
    fatGrams: 41,
    zone: "Zone 3",
    mins: 45,
    weight: WEIGHT_KG,
    met: 9.8,
  });
});

test("estimate with HR: avg ÷ (avg × 1.12) ≈ 89% → Zone 4, 40% fat", () => {
  const r = exerciseEstimate(RUN, { durationText: "45", hrText: "120" });
  assert.deepEqual([r.zone, r.fatPct, r.fatKcal, r.fatGrams], ["Zone 4", 40, 247, 27]);
  // 100 → max 112 → exactly 89.29%
  assert.equal(exerciseEstimate(YOGA, { durationText: "10", hrText: "100" }).zone, "Zone 4");
  // The estimated max is rounded: 9 → max 10 → 90% → Zone 5, 20% fat (only very low HRs get here)
  const r9 = exerciseEstimate(YOGA, { durationText: "10", hrText: "9" });
  assert.deepEqual([r9.zone, r9.fatPct], ["Zone 5", 20]);
});

test("tiles", () => {
  const r = exerciseEstimate(RUN, { durationText: "45", hrText: "" });
  assert.deepEqual(estimateTiles(r), [
    ["🔥 Kcal Burned", "617 kcal"],
    ["❤️ HR Zone", "Zone 3"],
    ["🧈 Fat Burn %", "60%"],
    ["🧈 Fat Burned", "41g (370 kcal)"],
  ]);
});

test("item: negative kcal, exercise flag, fat burned", () => {
  const r = exerciseEstimate(YOGA, { durationText: "20", hrText: "" });
  assert.deepEqual(exerciseItem(YOGA, r, "id1"), {
    id: "id1",
    name: "Yoga, Hatha (20 min)",
    kcal: -70,
    fat: 0,
    sat_fat: 0,
    carbs: 0,
    sugar: 0,
    fibre: 0,
    net_carbs: 0,
    protein: 0,
    is_exercise: 1,
    fat_burned_g: 5,
    fat_burned_kcal: 42,
  });
});

test("meal slot options: default slots, or the day's own meals with missing slots added", () => {
  const defaults = mealSlotOptions([], "2026-10-03");
  assert.deepEqual(
    defaults.map((o) => o.value),
    DEFAULT_MEAL_SLOTS.map((m) => "__slot__" + m.name),
  );
  assert.equal(defaults[0].key, 0);
  const day = { date: "2026-10-03", meals: [{ id: "m1", name: "☕ Breakfast", items: [] }] };
  const own = mealSlotOptions([day], "2026-10-03");
  assert.equal(own.length, DEFAULT_MEAL_SLOTS.length);
  assert.deepEqual(own[0], { key: "m1", value: "m1", label: "☕ Breakfast" });
  assert.match(own[1].value, /^[0-9a-z]{10,}$/); // added slots get ids
});

test("meal id: a real id as is, a slot name found in the day, or null", () => {
  const day = { meals: [{ id: "m1", name: "🌙 Dinner" }] };
  assert.equal(mealIdIn(day, "m9"), "m9");
  assert.equal(mealIdIn(day, "__slot__🌙 Dinner"), "m1");
  assert.equal(mealIdIn(day, "__slot__🍎 Snack"), null);
});

test("adding the item to one meal only", () => {
  const day = {
    date: "d",
    meals: [{ id: "a", items: [{ id: "x" }] }, { id: "b" }],
  };
  const out = withItemInMeal(day, "b", { id: "new" });
  assert.deepEqual(out.meals[1].items, [{ id: "new" }]);
  assert.equal(out.meals[0], day.meals[0]);
  assert.deepEqual(withItemInMeal(day, "a", { id: "n2" }).meals[0].items, [
    { id: "x" },
    { id: "n2" },
  ]);
  assert.equal(out.date, "d");
});
