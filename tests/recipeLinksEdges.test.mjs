// tests/recipeLinksEdges.test.mjs — edge cases of linked recipes (kept for Fix 26)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount,
  linkInfo,
  splitIngredients,
  combineNutrition,
  relinkDependent,
  applyLinkDelta,
  findDependentsDeep,
  normRecipeName,
} from "../src/constants/recipeLinks.js";

const A = { id: "a", name: "Stew", portion_g: 300, nutrition: { kcal: 300, protein: "10" } };
const NOWT = { id: "n", name: "Soup", nutrition: { kcal: 100 } };
const recipes = [A, NOWT];

test("normRecipeName: null-safe, collapses spaces", () => {
  assert.equal(normRecipeName(null), "");
  assert.equal(normRecipeName("  Big   Bowl\t"), "big bowl");
});

test("parseAmount: leading dot, trailing dot, plural kg, bare x", () => {
  assert.deepEqual(parseAmount(".5"), { portions: 0.5 });
  assert.equal(parseAmount("8 oz.").grams.toFixed(2), "226.80");
  assert.deepEqual(parseAmount("2 kgs"), { grams: 2000 });
  assert.deepEqual(parseAmount("2x"), { portions: 2 });
  assert.equal(parseAmount("2 3g"), null);
});

test("linkInfo: portions of a recipe with a weight give grams; kg works", () => {
  const p = linkInfo({ amount: "1.5", item: "stew" }, recipes, "x");
  assert.equal(p.grams, 450);
  assert.equal(p.factor, 1.5);
  assert.equal(p.nutrition.protein, 15); // string macros are numbers
  const k = linkInfo({ amount: "0.6kg", item: "Stew" }, recipes, "x");
  assert.equal(k.factor, 2);
  assert.equal(k.nutrition.kcal, 600);
  assert.equal(linkInfo({ amount: "1", item: "" }, recipes, "x"), null);
  assert.equal(linkInfo({ amount: "1", item: "Stew" }, null, "x"), null);
});

test("linkInfo: recipe with no nutrition scales to zeros", () => {
  const li = linkInfo({ amount: "1", item: "Bare" }, [{ id: "z", name: "Bare" }], "x");
  assert.equal(li.ok, true);
  assert.equal(li.nutrition.kcal, 0);
});

test("splitIngredients: unusable link and amount-only rows go to Claude; null recipe → empty", () => {
  const R = {
    id: "r",
    ingredients: [
      { amount: "200g", item: "Soup" },
      { amount: "2 eggs", item: "" },
      { amount: " ", item: " " },
    ],
  };
  const { linked, other } = splitIngredients(R, recipes);
  assert.equal(linked.length, 0);
  assert.deepEqual(other, R.ingredients.slice(0, 2));
  assert.deepEqual(splitIngredients(null, recipes), { linked: [], other: [] });
});

test("combineNutrition: servings missing/0 → 1; other total optional", () => {
  const linked = [linkInfo({ amount: "1", item: "Stew" }, recipes, "x")];
  assert.equal(combineNutrition(linked, null, 0).kcal, 300);
  assert.equal(combineNutrition(linked, undefined, "").kcal, 300);
  assert.equal(combineNutrition(linked, { kcal: "33.33" }, 3).kcal, 111.1);
  assert.equal(combineNutrition([], { fat: 1 }, 2).fat, 0.5);
});

const B = (over = {}) => ({
  id: "b",
  name: "Bowl",
  servings: 2,
  portion_g: 400,
  portion_g_source: "estimated",
  nutrition: { kcal: 500 },
  ingredients: [{ amount: "300g", item: "Stew" }],
  ...over,
});

test("applyLinkDelta: weight null when B has no weight or grams unknown", () => {
  const A2 = { ...A, nutrition: { kcal: 330 } };
  const { rows } = relinkDependent(B(), {
    oldA: A,
    newA: A2,
    recipesOld: recipes,
    recipesNew: [A2, NOWT],
  });
  assert.equal(applyLinkDelta(B({ portion_g: null }), rows).weight, null);
  const S2 = { ...NOWT, nutrition: { kcal: 120 } };
  const Bs = B({ ingredients: [{ amount: "1", item: "Soup" }] });
  const r2 = relinkDependent(Bs, {
    oldA: NOWT,
    newA: S2,
    recipesOld: recipes,
    recipesNew: [A, S2],
  }).rows;
  assert.equal(applyLinkDelta(Bs, r2).weight, null); // Soup has no Wt/portion → grams unknown
  assert.equal(applyLinkDelta(Bs, r2).nutrition.kcal, 510);
});

test("applyLinkDelta: servings 0 → 1; weight falling to ≤ 0 → null", () => {
  const A2 = { ...A, portion_g: 10 };
  const Bp = B({ servings: 0, portion_g: 100, ingredients: [{ amount: "1", item: "Stew" }] });
  const { rows } = relinkDependent(Bp, {
    oldA: A,
    newA: A2,
    recipesOld: recipes,
    recipesNew: [A2, NOWT],
  });
  assert.equal(applyLinkDelta(Bp, rows).weight, null); // 100 + (10 − 300)
  const A3 = { ...A, portion_g: 350 };
  const r3 = relinkDependent(Bp, {
    oldA: A,
    newA: A3,
    recipesOld: recipes,
    recipesNew: [A3, NOWT],
  }).rows;
  assert.deepEqual(applyLinkDelta(Bp, r3).weight, {
    portion_g: 150,
    portion_g_source: "estimated",
  });
});

test("relinkDependent: unchanged name keeps the row as is; blank rows ignored", () => {
  const Bx = B({
    ingredients: [
      { amount: "300g", item: "STEW" },
      { amount: "", item: "" },
    ],
  });
  const A2 = { ...A, nutrition: { kcal: 330 } };
  const out = relinkDependent(Bx, {
    oldA: A,
    newA: A2,
    recipesOld: recipes,
    recipesNew: [A2, NOWT],
  });
  assert.equal(out.ingredients[0].item, "STEW");
  assert.equal(out.rows.length, 1);
  assert.equal(out.deltaOk, true);
  assert.deepEqual(
    relinkDependent(null, { oldA: A, newA: A2, recipesOld: recipes, recipesNew: recipes }),
    {
      ingredients: [],
      rows: [],
      deltaOk: false,
    },
  );
});

test("relinkDependent: B already using A's new name links to the new A only", () => {
  const A2 = { ...A, name: "Stew 2" };
  const Bn = B({ ingredients: [{ amount: "300g", item: "stew 2" }] });
  const out = relinkDependent(Bn, {
    oldA: A,
    newA: A2,
    recipesOld: recipes,
    recipesNew: [A2, NOWT],
  });
  assert.equal(out.ingredients[0].item, "stew 2");
  assert.equal(out.rows[0].oldLi, null); // no "stew 2" before
  assert.equal(out.deltaOk, false);
});

test("findDependentsDeep: no recipe list → none", () => {
  assert.deepEqual(findDependentsDeep(A, undefined), []);
});
