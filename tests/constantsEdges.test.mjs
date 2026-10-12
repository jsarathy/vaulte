// tests/constantsEdges.test.mjs — edge cases in src/constants (meds, recipeLinks) that the mutation
// runs showed no test guarded (Fix 81). The data files exercises.js, recipes.js and seedDays.js
// are not mutated: they are lists, not logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDS_TASKS, isSunday, medsForDate } from "../src/constants/meds.js";
import {
  applyLinkDelta,
  combineNutrition,
  findDependentsDeep,
  findLinkedRecipe,
  linkInfo,
  parseAmount,
  relinkDependent,
  splitIngredients,
} from "../src/constants/recipeLinks.js";

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

// ---- meds.js
test("meds: the five scheduled meds, in order, with their times", () => {
  assert.deepEqual(MEDS_TASKS, [
    { id: "thyronorm", name: "Thyronorm", time: "07:00" },
    { id: "esomeprazole", name: "Esomeprazole", time: "11:45" },
    { id: "probiotic", name: " Vits / Aspirin", time: "12:00" },
    { id: "statin", name: "Statin / Amlodipine/ Allergy", time: "19:30" },
    { id: "vit_d", name: "Vit D", time: null, sunday: true },
  ]);
});

test("meds: Vit D is for Sundays only; other days get the four daily meds", () => {
  assert.equal(isSunday("2026-10-04"), true);
  assert.equal(isSunday("2026-10-05"), false);
  assert.equal(medsForDate("2026-10-04").length, 5);
  assert.deepEqual(
    medsForDate("2026-10-05").map((t) => t.id),
    ["thyronorm", "esomeprazole", "probiotic", "statin"],
  );
});

test("meds: isSunday names the same day in a time zone behind UTC", () => {
  assert.equal(
    inTimeZone("America/Los_Angeles", () => isSunday("2026-10-04")),
    true,
  );
  assert.equal(
    inTimeZone("America/Los_Angeles", () => isSunday("2026-10-05")),
    false,
  );
});

test("meds: from and to are inclusive; no from or no to means open-ended", () => {
  const tasks = [
    { id: "old", from: "2026-01-01", to: "2026-03-14" },
    { id: "new", from: "2026-03-15" },
    { id: "ended", to: "2026-02-01" },
    { id: "always" },
  ];
  const ids = (d) => medsForDate(d, tasks).map((t) => t.id);
  assert.deepEqual(ids("2025-12-31"), ["ended", "always"]); // before everything started
  assert.deepEqual(ids("2026-01-01"), ["old", "ended", "always"]); // first day of "old"
  assert.deepEqual(ids("2026-02-01"), ["old", "ended", "always"]); // last day of "ended"
  assert.deepEqual(ids("2026-02-02"), ["old", "always"]);
  assert.deepEqual(ids("2026-03-14"), ["old", "always"]); // last day of "old"
  assert.deepEqual(ids("2026-03-15"), ["new", "always"]); // first day of "new"
});

// ---- recipeLinks.js
const NUTR = {
  kcal: 200,
  fat: 10,
  sat_fat: 3,
  carbs: 20,
  sugar: 5,
  fibre: 2,
  net_carbs: 18,
  protein: 8,
};
const recipeA = { id: "a", name: "Base Sauce", portion_g: 100, servings: 4, nutrition: NUTR };

test("recipeLinks: parseAmount reads grams, ounces and portion words, with or without a space", () => {
  assert.deepEqual(parseAmount("250g"), { grams: 250 });
  assert.deepEqual(parseAmount(".25 kg"), { grams: 250 });
  assert.deepEqual(parseAmount("~ 60 g"), { grams: 60 });
  assert.deepEqual(parseAmount("1 serving"), { portions: 1 });
  assert.deepEqual(parseAmount("1 serve"), { portions: 1 });
  assert.deepEqual(parseAmount("2 serves"), { portions: 2 });
  assert.deepEqual(parseAmount("3 servings"), { portions: 3 });
  assert.deepEqual(parseAmount("1.5"), { portions: 1.5 });
  assert.deepEqual(parseAmount("2 x"), { portions: 2 });
  assert.equal(parseAmount("0 g"), null);
  assert.equal(parseAmount("2 cups"), null);
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount(undefined), null);
});

test("recipeLinks: a blank ingredient name finds no recipe, even one with a blank name", () => {
  const recipes = [{ id: "z", name: "" }, recipeA];
  assert.equal(findLinkedRecipe("", recipes, "self"), null);
  assert.equal(findLinkedRecipe(null, recipes, "self"), null);
  assert.equal(findLinkedRecipe("  BASE   sauce ", recipes, "self"), recipeA);
  assert.equal(findLinkedRecipe("base sauce", recipes, "a"), null); // never itself
});

test("recipeLinks: linkInfo handles a missing ingredient and says why an amount can't be used", () => {
  const recipes = [recipeA, { id: "b", name: "No Weight", nutrition: NUTR }];
  assert.equal(linkInfo(undefined, recipes, "x"), null);
  assert.deepEqual(
    linkInfo({ item: "base sauce", amount: "lots" }, recipes, "x").reason,
    "use an amount in g, kg, oz or portions",
  );
  assert.match(
    linkInfo({ item: "no weight", amount: "50g" }, recipes, "x").reason,
    /no Wt\/portion/,
  );
  const negative = [{ id: "n", name: "Odd", portion_g: -5, nutrition: NUTR }];
  assert.match(linkInfo({ item: "odd", amount: "50g" }, negative, "x").reason, /no Wt\/portion/);
  const ok = linkInfo({ item: "base sauce", amount: "50g" }, recipes, "x");
  assert.equal(ok.ok, true);
  assert.equal(ok.factor, 0.5);
  assert.equal(ok.nutrition.kcal, 100);
});

test("recipeLinks: splitIngredients drops blank rows and keeps a half-filled one", () => {
  const recipe = {
    id: "r",
    ingredients: [
      {},
      { amount: null, item: null },
      { amount: " ", item: " " },
      { amount: "100g", item: "" },
      { amount: "", item: "salt" },
      { amount: "50g", item: "base sauce" },
    ],
  };
  const out = splitIngredients(recipe, [recipeA]);
  assert.equal(out.linked.length, 1);
  assert.deepEqual(out.other, [
    { amount: "100g", item: "" },
    { amount: "", item: "salt" },
  ]);
  assert.deepEqual(splitIngredients(undefined, [recipeA]), { linked: [], other: [] });
});

test("recipeLinks: combineNutrition divides linked and other totals by the servings, 1 dp", () => {
  const linked = [{ nutrition: { ...NUTR, kcal: 100 } }, { nutrition: { ...NUTR, kcal: 55 } }];
  assert.equal(combineNutrition(linked, { kcal: 30 }, 2).kcal, 92.5);
  assert.equal(combineNutrition(linked, null, 0).kcal, 155); // no servings counts as 1
});

const B = (extra = {}) => ({
  id: "b",
  name: "Pie",
  servings: 2,
  ingredients: [{ amount: "100g", item: "Base Sauce" }],
  ...extra,
});
const A2 = { ...recipeA, nutrition: { ...NUTR, kcal: 400 } };

test("recipeLinks: relinkDependent keeps an ingredient's own spelling unless the recipe was renamed", () => {
  const spelled = B({ ingredients: [{ amount: "100g", item: "  base   SAUCE " }] });
  // a new recipe (no old version): the ingredient is left as written
  const created = relinkDependent(spelled, {
    oldA: null,
    newA: recipeA,
    recipesOld: [],
    recipesNew: [recipeA],
  });
  assert.equal(created.ingredients[0].item, "  base   SAUCE ");
  assert.equal(created.rows.length, 1);
  // renamed from "Old Sauce": an ingredient already using the new name is left as written
  const renamed = { ...recipeA, name: "Base Sauce" };
  const already = relinkDependent(spelled, {
    oldA: { ...recipeA, name: "Old Sauce" },
    newA: renamed,
    recipesOld: [],
    recipesNew: [renamed],
  });
  assert.equal(already.ingredients[0].item, "  base   SAUCE ");
  // the recipe was edited, not renamed: the ingredient is left as written
  const edited = relinkDependent(spelled, {
    oldA: recipeA,
    newA: { ...recipeA, nutrition: { ...NUTR, kcal: 999 } },
    recipesOld: [recipeA],
    recipesNew: [{ ...recipeA, nutrition: { ...NUTR, kcal: 999 } }],
  });
  assert.equal(edited.ingredients[0].item, "  base   SAUCE ");
  // an ingredient still using the old name follows the rename
  const old = B({ ingredients: [{ amount: "100g", item: "old sauce" }] });
  const followed = relinkDependent(old, {
    oldA: { ...recipeA, name: "Old Sauce" },
    newA: renamed,
    recipesOld: [{ ...recipeA, name: "Old Sauce" }],
    recipesNew: [renamed],
  });
  assert.equal(followed.ingredients[0].item, "Base Sauce");
});

test("recipeLinks: relinkDependent needs every row usable, and a new list that lacks the link is not usable", () => {
  const unrelated = B({ ingredients: [{ amount: "1", item: "Salt" }] });
  const none = relinkDependent(unrelated, {
    oldA: recipeA,
    newA: null,
    recipesOld: [recipeA],
    recipesNew: [],
  });
  assert.deepEqual(none.rows, []);
  assert.equal(none.deltaOk, false);
  // the new list lacks the recipe, so the new link is null
  const stale = relinkDependent(B(), {
    oldA: recipeA,
    newA: A2,
    recipesOld: [recipeA],
    recipesNew: [],
  });
  assert.equal(stale.rows.length, 1);
  assert.equal(stale.rows[0].newLi, null);
  assert.equal(stale.deltaOk, false);
  const two = B({
    ingredients: [
      { amount: "100g", item: "Base Sauce" },
      { amount: "some", item: "Base Sauce" },
    ],
  });
  const mixed = relinkDependent(two, {
    oldA: recipeA,
    newA: A2,
    recipesOld: [recipeA],
    recipesNew: [A2],
  });
  assert.equal(mixed.rows.length, 2);
  assert.equal(mixed.deltaOk, false); // one row cannot be used as it is
  const fine = relinkDependent(B(), {
    oldA: recipeA,
    newA: A2,
    recipesOld: [recipeA],
    recipesNew: [A2],
  });
  assert.equal(fine.deltaOk, true);
});

const row = (oldG, newG) => ({
  oldLi: { grams: oldG, nutrition: { ...NUTR, kcal: 100 } },
  newLi: { grams: newG, nutrition: { ...NUTR, kcal: 140 } },
});

test("recipeLinks: applyLinkDelta shifts the nutrition; the weight is kept ({}) or needs estimating (null)", () => {
  const b = { servings: 2, portion_g: 300, nutrition: { ...NUTR, kcal: 500 } };
  const out = applyLinkDelta(b, [row(100, 160)]);
  assert.equal(out.nutrition.kcal, 520); // 500 + (140 - 100) / 2
  assert.equal(out.weight, null); // the caller decides: keepWeight false means B needs a weight
  assert.deepEqual(applyLinkDelta(b, [row(100, 160)], { keepWeight: true }).weight, {});
  assert.equal(applyLinkDelta({ ...b, portion_g: undefined }, [row(100, 160)]).weight, null);
  // the grams of the linked recipes no longer matter to the weight
  assert.deepEqual(applyLinkDelta(b, [row(null, 160)], { keepWeight: true }).weight, {});
  assert.deepEqual(applyLinkDelta(b, [row(100, null)], { keepWeight: true }).weight, {});
});

test("recipeLinks: findDependentsDeep lists each dependent once, through other recipes", () => {
  const a = { id: "a", name: "A", ingredients: [] };
  const b = { id: "b", name: "B", ingredients: [{ item: "salt" }, { item: "a" }] };
  const c = { id: "c", name: "C", ingredients: [{ item: "a" }, { item: "B" }] };
  const d = { id: "d", name: "D", ingredients: [{ item: "pepper" }] };
  assert.deepEqual(
    findDependentsDeep(a, [a, b, c, d]).map((r) => r.id),
    ["b", "c"],
  );
  assert.deepEqual(findDependentsDeep(a, undefined), []);
  assert.deepEqual(findDependentsDeep(a, [a, { id: "a2", name: "a", ingredients: [] }, b]), []); // a duplicate name keeps them linked
});
