// tests/recipeLinks.test.mjs — saved recipes used as ingredients (Fix 21)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount,
  findLinkedRecipe,
  linkInfo,
  splitIngredients,
  combineNutrition,
} from "../src/constants/recipeLinks.js";

const A = {
  id: "a",
  name: "Pinto Bean Stew",
  portion_g: 328,
  nutrition: { kcal: 338, fat: 11, carbs: 46, fibre: 15, net_carbs: 31, protein: 15 },
};
const N = { id: "n", name: "Nimbu Pani", nutrition: { kcal: 9 } };
const recipes = [A, N];

test("parseAmount: weights", () => {
  assert.deepEqual(parseAmount("250g"), { grams: 250 });
  assert.deepEqual(parseAmount(" 250 G "), { grams: 250 });
  assert.deepEqual(parseAmount("~60g"), { grams: 60 });
  assert.deepEqual(parseAmount("0.25 kg"), { grams: 250 });
  assert.equal(parseAmount("2 oz").grams.toFixed(3), "56.699");
});
test("parseAmount: portions and rejects", () => {
  assert.deepEqual(parseAmount("1 portion"), { portions: 1 });
  assert.deepEqual(parseAmount("2 servings"), { portions: 2 });
  assert.deepEqual(parseAmount("1.5"), { portions: 1.5 });
  for (const s of ["3 tbsp", "1 cup", "", "a handful", "0g", "-5g", null])
    assert.equal(parseAmount(s), null, String(s));
});
test("findLinkedRecipe: case/space-insensitive, never itself", () => {
  assert.equal(findLinkedRecipe("  pinto   bean STEW ", recipes, "x"), A);
  assert.equal(findLinkedRecipe("Pinto Bean Stew", recipes, "a"), null);
  assert.equal(findLinkedRecipe("Pinto beans", recipes, "x"), null);
});
test("linkInfo: grams scale by Wt/portion", () => {
  const li = linkInfo({ amount: "250g", item: "Pinto Bean Stew" }, recipes, "x");
  assert.equal(li.ok, true);
  assert.equal(li.grams, 250);
  assert.equal(Math.round(li.nutrition.kcal * 10) / 10, 257.6); // 338 × 250/328
  assert.equal(li.nutrition.sat_fat, 0); // missing macro → 0
});
test("linkInfo: portions; grams without Wt/portion is not usable", () => {
  const p = linkInfo({ amount: "2 portions", item: "Nimbu Pani" }, recipes, "x");
  assert.equal(p.ok, true);
  assert.equal(p.nutrition.kcal, 18);
  assert.equal(p.grams, null);
  const g = linkInfo({ amount: "200g", item: "Nimbu Pani" }, recipes, "x");
  assert.equal(g.ok, false);
  assert.match(g.reason, /no Wt\/portion/);
  assert.equal(linkInfo({ amount: "3 tbsp", item: "Pinto Bean Stew" }, recipes, "x").ok, false);
  assert.equal(linkInfo({ amount: "350g", item: "Basmati rice" }, recipes, "x"), null);
});
test("splitIngredients + combineNutrition: A + rice, 2 servings", () => {
  const B = {
    id: "b",
    servings: 2,
    ingredients: [
      { amount: "250g", item: "Pinto Bean Stew" },
      { amount: "350g", item: "Cooked basmati rice" },
      { amount: "", item: "" },
    ],
  };
  const { linked, other } = splitIngredients(B, recipes);
  assert.equal(linked.length, 1);
  assert.deepEqual(other, [{ amount: "350g", item: "Cooked basmati rice" }]);
  const n = combineNutrition(linked, { kcal: 455, protein: 9.5 }, 2);
  assert.equal(n.kcal, Math.round((((338 * 250) / 328 + 455) / 2) * 10) / 10); // 356.3
  assert.equal(n.protein, Math.round((((15 * 250) / 328 + 9.5) / 2) * 10) / 10);
  assert.equal(n.sugar, 0);
});

// ── Fix 22: dependent recipes follow changes to the recipes they use ─────────
import { relinkDependent, applyLinkDelta } from "../src/constants/recipeLinks.js";
const B = {
  id: "b",
  name: "Pinto Rice Bowl",
  servings: 2,
  portion_g: 300,
  portion_g_source: "estimated",
  ingredients: [
    { amount: "250g", item: "Pinto Bean Stew" },
    { amount: "350g", item: "Cooked basmati rice" },
  ],
  nutrition: {
    kcal: 733.8,
    fat: 9.2,
    sat_fat: 1,
    carbs: 37.5,
    sugar: 2.5,
    fibre: 11.7,
    net_carbs: 25.8,
    protein: 15.7,
  },
};

test("relink: unrelated recipe has no rows", () => {
  const C = { id: "c", name: "Toast", ingredients: [{ amount: "1", item: "Bread" }] };
  assert.equal(
    relinkDependent(C, A, { ...A, nutrition: { kcal: 400 } }, recipes, recipes).rows.length,
    0,
  );
});
test("A's kcal 338 → 400: B changes by (400−338)×250/328 ÷ 2", () => {
  const A2 = { ...A, nutrition: { ...A.nutrition, kcal: 400 } };
  const { rows, deltaOk, ingredients } = relinkDependent(B, A, A2, recipes, [A2, N]);
  assert.equal(deltaOk, true);
  assert.deepEqual(ingredients, B.ingredients);
  const { nutrition, weight } = applyLinkDelta(B, rows);
  assert.equal(nutrition.kcal, Math.round((733.8 + ((400 - 338) * 250) / 328 / 2) * 10) / 10); // 757.4
  assert.equal(nutrition.protein, 15.7);
  assert.deepEqual(weight, { portion_g: 300, portion_g_source: "estimated" }); // grams unchanged
});
test("A's Wt/portion 328 → 400: grams link re-scales, B's weight unchanged", () => {
  const A2 = { ...A, portion_g: 400 };
  const { rows } = relinkDependent(B, A, A2, recipes, [A2, N]);
  const { nutrition } = applyLinkDelta(B, rows);
  assert.equal(
    nutrition.kcal,
    Math.round((733.8 + ((338 * 250) / 400 - (338 * 250) / 328) / 2) * 10) / 10,
  );
});
test("portions link: A's weight change moves B's estimated weight; weighed B kept", () => {
  const Bp = {
    ...B,
    ingredients: [{ amount: "1 portion", item: "Pinto Bean Stew" }, B.ingredients[1]],
  };
  const A2 = { ...A, portion_g: 340 };
  const { rows } = relinkDependent(Bp, A, A2, recipes, [A2, N]);
  assert.deepEqual(applyLinkDelta(Bp, rows).weight, {
    portion_g: 306,
    portion_g_source: "estimated",
  }); // 300 + 12/2
  assert.deepEqual(
    applyLinkDelta({ ...Bp, portion_g_source: "weighed" }, rows, { keepWeight: true }).weight,
    {},
  );
});
test("rename: B's ingredient follows the new name", () => {
  const A2 = { ...A, name: "Pinto Stew v2" };
  const { ingredients, deltaOk } = relinkDependent(B, A, A2, recipes, [A2, N]);
  assert.equal(ingredients[0].item, "Pinto Stew v2");
  assert.equal(deltaOk, true);
});
test("not usable before (no Wt/portion) → full recalculation needed", () => {
  const A0 = { ...A, portion_g: undefined };
  const { deltaOk, rows } = relinkDependent(B, A0, A, [A0, N], recipes);
  assert.equal(rows.length, 1);
  assert.equal(deltaOk, false);
});
test("new recipe matching an ingredient name → full recalculation", () => {
  const R = { id: "r", name: "Cooked basmati rice", portion_g: 150, nutrition: { kcal: 190 } };
  const { rows, deltaOk } = relinkDependent(B, null, R, recipes, [...recipes, R]);
  assert.equal(rows.length, 1);
  assert.equal(deltaOk, false);
});

// ── Fix 23: deleting a recipe deletes the recipes built on it ────────────────
import { findDependentsDeep } from "../src/constants/recipeLinks.js";
test("findDependentsDeep: direct + indirect, unrelated kept, cycle-safe", () => {
  const Bd = { id: "b", name: "Bowl", ingredients: [{ amount: "250g", item: "pinto bean stew" }] }; // uses A (any case)
  const Cd = { id: "c", name: "Big Bowl", ingredients: [{ amount: "1 portion", item: "Bowl" }] }; // uses B
  const Dd = { id: "d", name: "Toast", ingredients: [{ amount: "1", item: "Bread" }] }; // unrelated
  const Ac = { ...A, ingredients: [{ amount: "1 portion", item: "Big Bowl" }] }; // A uses C → cycle
  assert.deepEqual(
    findDependentsDeep(Ac, [Ac, Bd, Cd, Dd]).map((r) => r.id),
    ["b", "c"],
  );
  assert.deepEqual(findDependentsDeep(Dd, [Ac, Bd, Cd, Dd]), []);
});

// ── Fix 25: duplicate recipe names ───────────────────────────────────────────
import { findNameClash } from "../src/constants/recipeLinks.js";
test("findNameClash: case/space-insensitive, ignores itself", () => {
  assert.equal(findNameClash("  pinto BEAN stew", recipes, "x"), A);
  assert.equal(findNameClash("Pinto Bean Stew", recipes, "a"), null);
  assert.equal(findNameClash("", recipes, "x"), null);
});
test("deleting one of two same-named recipes deletes no dependents", () => {
  const A2 = { ...A, id: "a2" };
  const Bd = { id: "b", name: "Bowl", ingredients: [{ amount: "250g", item: "Pinto Bean Stew" }] };
  assert.deepEqual(findDependentsDeep(A2, [A, A2, Bd]), []);
  assert.deepEqual(
    findDependentsDeep(A, [A, Bd]).map((r) => r.id),
    ["b"],
  );
});
