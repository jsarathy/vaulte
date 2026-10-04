// tests/foodLookup.test.mjs — "Get Nutrition" logic (Fix 26 PR 8)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOKUP_UNITS,
  parseQty,
  amountText,
  lookupPrompt,
  parseLookupReply,
  isDish,
  formItemFromLookup,
  recipeFromLookup,
  sameNameRecipes,
  withoutName,
  replaceByNameSorted,
} from "../src/lib/foodLookup.js";

test("units and quantity", () => {
  assert.deepEqual(
    LOOKUP_UNITS.map(([u]) => u),
    ["portion", "g", "ml", "oz", "cup", "tbsp", "tsp"],
  );
  assert.equal(parseQty("2.5"), 2.5);
  for (const t of ["", "0", "x"]) assert.equal(parseQty(t), 1);
});

test("amount text and prompt", () => {
  assert.equal(amountText(1, "portion"), "1 portion");
  assert.equal(amountText(0.5, "portion"), "0.5 portions");
  assert.equal(amountText(150, "g"), "150 g");
  const p = lookupPrompt({ name: "Rice", qty: 2, unit: "portion" });
  assert.match(p, /^First decide: is "Rice" a single food/);
  assert.match(p, /give the nutrition for 2 portions of "Rice"\./);
  assert.match(p, /"display_name":"Rice \(2 portion\)"/);
  assert.match(lookupPrompt({ name: "Milk", qty: 200, unit: "ml" }), /"Milk \(200 ml\)"/);
});

test("reply: fences stripped; empty → {}; junk throws", () => {
  assert.deepEqual(parseLookupReply({ content: [{ text: '```json\n{"kcal":5}\n```' }] }), {
    kcal: 5,
  });
  assert.deepEqual(parseLookupReply({}), {});
  assert.throws(() => parseLookupReply({ content: [{ text: "sorry" }] }));
});

test("dish detection is case-insensitive", () => {
  assert.equal(isDish({ kind: "dish" }), true);
  assert.equal(isDish({ kind: "INGREDIENT" }), false);
  assert.equal(isDish({}), false);
});

test("form item: display name or name (qty unit); missing blank, zero kept", () => {
  const req = { name: "Rice", qty: 150, unit: "g" };
  assert.deepEqual(formItemFromLookup({ kcal: 0, fat: 1 }, req), {
    name: "Rice (150 g)",
    kcal: 0,
    fat: 1,
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });
  assert.equal(formItemFromLookup({ display_name: "Cooked rice" }, req).name, "Cooked rice");
});

test("saved recipe: per portion for portions, as entered otherwise; grams → Wt/portion", () => {
  const two = recipeFromLookup(
    { kcal: 104.6, fat: "0.4", fibre: "x" },
    { name: "Apple", qty: 2, unit: "portion", id: "i" },
  );
  assert.deepEqual(two, {
    id: "i",
    name: "Apple",
    description: "",
    source: "Get Nutrition",
    servings: 1,
    prep_time: "",
    cook_time: "",
    ingredients: [{ amount: "1 portion", item: "Apple" }],
    steps: [],
    notes: "",
    nutrition: {
      kcal: 52.3,
      fat: 0.2,
      sat_fat: 0,
      carbs: 0,
      sugar: 0,
      fibre: 0,
      net_carbs: 0,
      protein: 0,
    },
  });
  const rice = recipeFromLookup({ kcal: 195 }, { name: "Rice", qty: 150, unit: "g", id: "r" });
  assert.deepEqual(rice.ingredients, [{ amount: "150 g", item: "Rice" }]);
  assert.equal(rice.nutrition.kcal, 195);
  assert.equal(rice.portion_g, 150);
  assert.equal("portion_g" in recipeFromLookup({}, { name: "M", qty: 2, unit: "ml" }), false);
});

test("same-name helpers", () => {
  const list = [
    { id: "1", name: " oats " },
    { id: "2", name: "Bread" },
    { id: "3", name: "OATS" },
  ];
  assert.deepEqual(
    sameNameRecipes(list, "Oats").map((r) => r.id),
    ["1", "3"],
  );
  assert.deepEqual(
    withoutName(list, "oats").map((r) => r.id),
    ["2"],
  );
  assert.deepEqual(
    replaceByNameSorted(list, { id: "1", name: "Oats" }).map((r) => r.name),
    ["Bread", "Oats"],
  );
  assert.deepEqual(
    replaceByNameSorted(list, { id: "9", name: "Apple" }).map((r) => r.name),
    [" oats ", "Apple", "Bread", "OATS"],
  );
});
