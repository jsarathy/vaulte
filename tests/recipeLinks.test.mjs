// tests/recipeLinks.test.mjs — saved recipes used as ingredients (Fix 21)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, findLinkedRecipe, linkInfo, splitIngredients, combineNutrition } from "../src/constants/recipeLinks.js";

const A = { id:"a", name:"Pinto Bean Stew", portion_g:328, nutrition:{ kcal:338, fat:11, carbs:46, fibre:15, net_carbs:31, protein:15 } };
const N = { id:"n", name:"Nimbu Pani", nutrition:{ kcal:9 } };
const recipes = [A, N];

test("parseAmount: weights", () => {
  assert.deepEqual(parseAmount("250g"), { grams:250 });
  assert.deepEqual(parseAmount(" 250 G "), { grams:250 });
  assert.deepEqual(parseAmount("~60g"), { grams:60 });
  assert.deepEqual(parseAmount("0.25 kg"), { grams:250 });
  assert.equal(parseAmount("2 oz").grams.toFixed(3), "56.699");
});
test("parseAmount: portions and rejects", () => {
  assert.deepEqual(parseAmount("1 portion"), { portions:1 });
  assert.deepEqual(parseAmount("2 servings"), { portions:2 });
  assert.deepEqual(parseAmount("1.5"), { portions:1.5 });
  for (const s of ["3 tbsp", "1 cup", "", "a handful", "0g", "-5g", null]) assert.equal(parseAmount(s), null, String(s));
});
test("findLinkedRecipe: case/space-insensitive, never itself", () => {
  assert.equal(findLinkedRecipe("  pinto   bean STEW ", recipes, "x"), A);
  assert.equal(findLinkedRecipe("Pinto Bean Stew", recipes, "a"), null);
  assert.equal(findLinkedRecipe("Pinto beans", recipes, "x"), null);
});
test("linkInfo: grams scale by Wt/portion", () => {
  const li = linkInfo({ amount:"250g", item:"Pinto Bean Stew" }, recipes, "x");
  assert.equal(li.ok, true);
  assert.equal(li.grams, 250);
  assert.equal(Math.round(li.nutrition.kcal * 10) / 10, 257.6); // 338 × 250/328
  assert.equal(li.nutrition.sat_fat, 0);                       // missing macro → 0
});
test("linkInfo: portions; grams without Wt/portion is not usable", () => {
  const p = linkInfo({ amount:"2 portions", item:"Nimbu Pani" }, recipes, "x");
  assert.equal(p.ok, true); assert.equal(p.nutrition.kcal, 18); assert.equal(p.grams, null);
  const g = linkInfo({ amount:"200g", item:"Nimbu Pani" }, recipes, "x");
  assert.equal(g.ok, false); assert.match(g.reason, /no Wt\/portion/);
  assert.equal(linkInfo({ amount:"3 tbsp", item:"Pinto Bean Stew" }, recipes, "x").ok, false);
  assert.equal(linkInfo({ amount:"350g", item:"Basmati rice" }, recipes, "x"), null);
});
test("splitIngredients + combineNutrition: A + rice, 2 servings", () => {
  const B = { id:"b", servings:2, ingredients:[{ amount:"250g", item:"Pinto Bean Stew" }, { amount:"350g", item:"Cooked basmati rice" }, { amount:"", item:"" }] };
  const { linked, other } = splitIngredients(B, recipes);
  assert.equal(linked.length, 1); assert.deepEqual(other, [{ amount:"350g", item:"Cooked basmati rice" }]);
  const n = combineNutrition(linked, { kcal:455, protein:9.5 }, 2);
  assert.equal(n.kcal, Math.round((338 * 250 / 328 + 455) / 2 * 10) / 10); // 356.3
  assert.equal(n.protein, Math.round((15 * 250 / 328 + 9.5) / 2 * 10) / 10);
  assert.equal(n.sugar, 0);
});
