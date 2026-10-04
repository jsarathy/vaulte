// tests/mealsAndDates.test.mjs — ids, date labels, meal slots, day totals (kept for Fix 26)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  genId,
  formatDate,
  formatDateShort,
  makeMeals,
  DEFAULT_MEAL_SLOTS,
  ensureMealSlots,
  getDayTotals,
} from "../src/constants/helpers.js";

test("genId: unique base-36 strings", () => {
  const ids = new Set(Array.from({ length: 200 }, genId));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^[0-9a-z]{10,}$/);
});

test("date labels (en-GB, noon so time zones can't shift the day)", () => {
  assert.equal(formatDate("2026-10-04"), "Sun, 4 Oct 2026");
  assert.equal(formatDateShort("2026-10-04"), "Sun 4 Oct");
  assert.equal(formatDate("2027-01-01"), "Fri, 1 Jan 2027");
});

test("makeMeals: every default slot, fresh ids, empty items", () => {
  const meals = makeMeals();
  assert.deepEqual(
    meals.map(({ name, is_exercise, items }) => ({ name, is_exercise, items })),
    DEFAULT_MEAL_SLOTS.map((s) => ({ ...s, items: [] })),
  );
  assert.equal(new Set(meals.map((m) => m.id)).size, meals.length);
  assert.notEqual(makeMeals()[0].items, meals[0].items);
});

test("ensureMealSlots: custom meals kept after the defaults, in their own order", () => {
  const day = {
    date: "2026-10-04",
    notes: "n",
    meals: [
      { id: "c1", name: "Late snack", is_exercise: 0, items: [{ kcal: 1 }] },
      { id: "d", name: "🌙 Dinner", is_exercise: 0 },
      { id: "c2", name: "Midnight", is_exercise: 0, items: [] },
    ],
  };
  const out = ensureMealSlots(day);
  const names = out.meals.map((m) => m.name);
  assert.deepEqual(
    names.slice(0, DEFAULT_MEAL_SLOTS.length),
    DEFAULT_MEAL_SLOTS.map((s) => s.name),
  );
  assert.deepEqual(names.slice(DEFAULT_MEAL_SLOTS.length), ["Late snack", "Midnight"]);
  assert.equal(out.meals.find((m) => m.name === "🌙 Dinner").id, "d");
  assert.deepEqual(out.meals.find((m) => m.name === "🌙 Dinner").items, []);
  assert.equal(out.notes, "n");
  assert.equal(day.meals.length, 3); // input not mutated
});

test("ensureMealSlots: complete day keeps its order (custom meals stay where they are)", () => {
  const meals = [
    { id: "c", name: "Custom", is_exercise: 0 },
    ...DEFAULT_MEAL_SLOTS.map((s, i) => ({ ...s, id: `m${i}`, items: [] })),
  ];
  const out = ensureMealSlots({ meals });
  assert.deepEqual(
    out.meals.map((m) => m.id),
    meals.map((m) => m.id),
  );
  assert.deepEqual(out.meals[0].items, []);
});

test("ensureMealSlots: day with no meals field gets every slot", () => {
  assert.equal(ensureMealSlots({ date: "d" }).meals.length, DEFAULT_MEAL_SLOTS.length);
});

test("getDayTotals: every macro summed; exercise burn is positive", () => {
  const day = {
    meals: [
      {
        is_exercise: 0,
        items: [
          { kcal: 100, fat: 1, carbs: 2, sugar: 3, fibre: 4, net_carbs: 5, protein: 6 },
          { kcal: 50, fat: 1, carbs: 1, sugar: 1, fibre: 1, net_carbs: 1, protein: 1 },
        ],
      },
      { is_exercise: 1, items: [{ kcal: -200 }] },
      { is_exercise: 0 },
    ],
  };
  assert.deepEqual(getDayTotals(day), {
    kcal: -50,
    fat: 2,
    carbs: 3,
    sugar: 4,
    fibre: 5,
    net_carbs: 6,
    protein: 7,
    foodKcal: 150,
    exerciseBurned: 200,
  });
  assert.equal(getDayTotals({}).kcal, 0);
});
