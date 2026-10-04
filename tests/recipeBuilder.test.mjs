// tests/recipeBuilder.test.mjs — recipe builder logic (Fix 26 PR 6)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nutritionKey,
  editorCopy,
  nameProblem,
  prepareGenerated,
  upsertSorted,
  dependentsNotice,
  dependentsFailedNotice,
  formItemFromRecipe,
  saveLabel,
  ERRORS,
} from "../src/lib/recipeBuilder.js";

const R = {
  id: "a",
  name: "Dal",
  servings: 2,
  ingredients: [
    { amount: " 100g ", item: "lentils " },
    { amount: "", item: "" },
  ],
};

test("nutritionKey: servings + trimmed non-blank rows only", () => {
  const k = nutritionKey(R);
  assert.equal(k, JSON.stringify({ s: 2, i: [["100g", "lentils"]] }));
  assert.equal(nutritionKey({ ...R, ingredients: [...R.ingredients, { amount: " " }] }), k);
  assert.notEqual(nutritionKey({ ...R, servings: 3 }), k);
  assert.notEqual(nutritionKey({ ...R, ingredients: [{ amount: "", item: "salt" }] }), k);
  assert.equal(nutritionKey(null), JSON.stringify({ s: 0, i: [] }));
  assert.equal(nutritionKey({ servings: "x" }), JSON.stringify({ s: 0, i: [] }));
});

test("editorCopy: deep copy", () => {
  const c = editorCopy(R);
  assert.deepEqual(c, R);
  c.ingredients[0].item = "changed";
  assert.equal(R.ingredients[0].item, "lentils ");
});

test("nameProblem: blank, clash with another recipe, or none", () => {
  const saved = [{ id: "b", name: "Big  Bowl" }, R];
  assert.equal(nameProblem({ id: "x", name: "  " }, saved), "Give the recipe a name.");
  assert.equal(nameProblem({ id: "x" }, saved), "Give the recipe a name.");
  assert.equal(
    nameProblem({ id: "x", name: "big bowl" }, saved),
    'A saved recipe is already called "Big  Bowl" — choose another name.',
  );
  assert.equal(nameProblem({ id: "a", name: "DAL" }, saved), null); // itself
  assert.equal(nameProblem({ id: "x", name: "Soup" }, saved), null);
});

test("prepareGenerated: id; weight rounded + estimated, or null", () => {
  assert.deepEqual(prepareGenerated({ name: "S", portion_g: "224.6" }, "id1"), {
    name: "S",
    id: "id1",
    portion_g: 225,
    portion_g_source: "estimated",
  });
  assert.deepEqual(prepareGenerated({ name: "S", portion_g: 0 }, "id2"), {
    name: "S",
    id: "id2",
    portion_g: null,
  });
  assert.equal(prepareGenerated({ name: "S" }, "id3").portion_g, null);
});

test("upsertSorted: replaces by id, sorted by name, input untouched", () => {
  const list = [
    { id: "1", name: "Soup" },
    { id: "2", name: "Apple" },
  ];
  assert.deepEqual(
    upsertSorted(list, { id: "1", name: "Bread" }).map((r) => r.name),
    ["Apple", "Bread"],
  );
  assert.deepEqual(
    upsertSorted(list, { id: "3", name: "Cake" }).map((r) => r.id),
    ["2", "3", "1"],
  );
  assert.equal(list.length, 2);
});

test("dependents notices", () => {
  assert.equal(dependentsNotice([]), null);
  assert.deepEqual(dependentsNotice(["B"]), {
    ok: true,
    text: "Also updated 1 recipe that uses it: B",
  });
  assert.equal(dependentsNotice(["B", "C"]).text, "Also updated 2 recipes that use it: B, C");
  assert.deepEqual(dependentsFailedNotice(new Error("boom")), {
    ok: false,
    text: "Saved, but couldn't update recipes that use it (boom) — open them and save to recalculate.",
  });
  assert.match(dependentsFailedNotice({}).text, /\(error\)/);
});

test("formItemFromRecipe: name + every macro; missing or 0 → blank", () => {
  assert.deepEqual(formItemFromRecipe({ name: "Dal", nutrition: { kcal: 300, fat: 0 } }), {
    name: "Dal",
    kcal: 300,
    fat: "",
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });
  assert.equal(formItemFromRecipe({ name: "X" }).kcal, "");
});

test("saveLabel", () => {
  assert.equal(saveLabel({ saving: true, stale: true }), "⏳ Recalculating & saving…");
  assert.equal(saveLabel({ saving: true, stale: false, editing: "a" }), "⏳ Saving…");
  assert.equal(saveLabel({ saving: false, editing: "a" }), "✓ Save Changes");
  assert.equal(saveLabel({ saving: false, editing: null }), "✓ Save Recipe");
});

test("error texts", () => {
  assert.match(ERRORS.generate, /^Could not parse recipe/);
  assert.equal(ERRORS.save, "Could not save recipe.");
  assert.equal(ERRORS.recalc, "Could not recalculate nutrition.");
});
