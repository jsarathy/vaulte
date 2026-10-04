// tests/recipeEdits.test.mjs — edits in the recipe builder's form (Fix 26 PR 7)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withField,
  withServings,
  withWeighedPortion,
  withMacro,
  withIngredient,
  withoutIngredient,
  withNewIngredient,
  withStep,
  withoutStep,
  withNewStep,
  linkableRecipes,
  linkBadgeText,
} from "../src/lib/recipeEdits.js";

const R = {
  id: "r",
  name: "Dal",
  servings: 2,
  nutrition: { kcal: 300 },
  ingredients: [
    { amount: "100g", item: "lentils" },
    { amount: "1", item: "onion" },
  ],
  steps: ["Boil", "Serve"],
};

test("fields and servings; the original is never changed", () => {
  assert.equal(withField(R, "notes", "spicy").notes, "spicy");
  assert.equal(withServings(R, "4").servings, 4);
  for (const t of ["", "0", "abc"]) assert.equal(withServings(R, t).servings, "");
  assert.equal(R.servings, 2);
});

test("Wt/portion typed → weighed; blank, zero or invalid → cleared", () => {
  assert.deepEqual(
    { ...withWeighedPortion(R, "225.5") },
    { ...R, portion_g: 225.5, portion_g_source: "weighed" },
  );
  for (const t of ["", "0", "-3", "x", "Infinity"]) {
    const r = withWeighedPortion(R, t);
    assert.deepEqual([r.portion_g, r.portion_g_source], [null, null], t);
  }
});

test("macro typed: number, invalid → 0, other macros kept, no nutrition yet ok", () => {
  assert.deepEqual(withMacro(R, "fat", "12.5").nutrition, { kcal: 300, fat: 12.5 });
  assert.equal(withMacro(R, "kcal", "x").nutrition.kcal, 0);
  assert.deepEqual(withMacro({ id: "n" }, "kcal", "5").nutrition, { kcal: 5 });
  assert.deepEqual(R.nutrition, { kcal: 300 });
});

test("ingredients: change one field of one row, remove, add a blank row", () => {
  const changed = withIngredient(R, 1, { field: "item", value: "red onion" });
  assert.deepEqual(changed.ingredients, [R.ingredients[0], { amount: "1", item: "red onion" }]);
  assert.equal(
    withIngredient(R, 0, { field: "amount", value: " 2 kg" }).ingredients[0].amount,
    " 2 kg",
  );
  assert.deepEqual(withoutIngredient(R, 0).ingredients, [R.ingredients[1]]);
  assert.deepEqual(withoutIngredient(R, 1).ingredients, [R.ingredients[0]]);
  assert.deepEqual(withNewIngredient(R).ingredients.at(-1), { amount: "", item: "" });
  assert.deepEqual(withNewIngredient({}).ingredients, [{ amount: "", item: "" }]);
  assert.equal(R.ingredients.length, 2);
  assert.equal(R.ingredients[1].item, "onion");
});

test("steps: change, remove, add", () => {
  assert.deepEqual(withStep(R, 1, "Eat").steps, ["Boil", "Eat"]);
  assert.deepEqual(withoutStep(R, 0).steps, ["Serve"]);
  assert.deepEqual(withNewStep(R).steps, ["Boil", "Serve", ""]);
  assert.deepEqual(withNewStep({}).steps, [""]);
});

test("linkable recipes exclude the recipe itself", () => {
  assert.deepEqual(
    linkableRecipes([{ id: "r" }, { id: "s" }], "r").map((r) => r.id),
    ["s"],
  );
});

test("link badge text", () => {
  assert.equal(linkBadgeText(null), null);
  assert.equal(
    linkBadgeText({ ok: true, grams: 250.4, factor: 250 / 328, nutrition: { kcal: 257.6 } }),
    "📖 Saved recipe · 250 g · 0.76 portions · 258 kcal",
  );
  assert.equal(
    linkBadgeText({ ok: true, grams: null, factor: 1, nutrition: { kcal: 9 } }),
    "📖 Saved recipe · 1 portion · 9 kcal",
  );
  assert.equal(
    linkBadgeText({ ok: true, grams: 0, factor: 0, nutrition: { kcal: 0 } }),
    "📖 Saved recipe · 0 g · 0 portions · 0 kcal",
  );
  assert.equal(
    linkBadgeText({ ok: false, reason: "use an amount in g, kg, oz or portions" }),
    "📖 Saved recipe — use an amount in g, kg, oz or portions; Claude will estimate it instead",
  );
});
