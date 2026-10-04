// tests/dayMeals.test.mjs — adding entries to a day's meals (Fix 26 PR 12)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mealIdIn, withItemsInMeal } from "../src/lib/dayMeals.js";

const DAY = {
  date: "2026-10-03",
  notes: "n",
  meals: [
    { id: "b", name: "☕ Breakfast", items: [{ id: "x" }] },
    { id: "l", name: "🥗 Lunch" },
  ],
};

test("meal id: ids pass through; slots resolve by name; unknown slot or none → null", () => {
  assert.equal(mealIdIn(DAY, "l"), "l");
  assert.equal(mealIdIn(DAY, "__slot__🥗 Lunch"), "l");
  assert.equal(mealIdIn(DAY, "__slot__🌙 Dinner"), null);
  assert.equal(mealIdIn(DAY, ""), "");
  assert.equal(mealIdIn(DAY, undefined), undefined);
});

test("items go after the meal's existing ones; other meals and fields kept", () => {
  const a = { id: "a" };
  const c = { id: "c" };
  const out = withItemsInMeal(DAY, "b", [a, c]);
  assert.deepEqual(out.meals[0], { id: "b", name: "☕ Breakfast", items: [{ id: "x" }, a, c] });
  assert.equal(out.meals[1], DAY.meals[1]);
  assert.equal(out.notes, "n");
  assert.deepEqual(withItemsInMeal(DAY, "l", [a]).meals[1].items, [a]);
  assert.deepEqual(DAY.meals[0].items, [{ id: "x" }]); // not mutated
});
