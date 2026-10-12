// tests/savedRecipes.test.mjs — Saved Recipes list texts (Fix 26 PR 9)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteConfirmText,
  deletedNotice,
  filterRecipes,
  volumeLabel,
  weightLabel,
  withoutRecipes,
} from "../src/lib/savedRecipes.js";

const A = { id: "a", name: "Stew" };
const B = { id: "b", name: "Bowl" };
const C = { id: "c", name: "Big Bowl" };

test("delete confirm: plain, one dependent, several", () => {
  assert.equal(deleteConfirmText(A, []), 'Delete "Stew"?');
  assert.equal(
    deleteConfirmText(A, [B]),
    'Delete "Stew"?\n\nThis also deletes 1 recipe that uses it:\n• Bowl\n\nFood already logged isn\'t affected.',
  );
  assert.equal(
    deleteConfirmText(A, [B, C]),
    'Delete "Stew"?\n\nThis also deletes 2 recipes that use it:\n• Bowl\n• Big Bowl\n\nFood already logged isn\'t affected.',
  );
});

test("deleted notice: none without dependents", () => {
  assert.equal(deletedNotice(A, []), null);
  assert.deepEqual(deletedNotice(A, [B]), {
    ok: true,
    text: "Deleted Stew and 1 recipe that used it: Bowl",
  });
  assert.equal(
    deletedNotice(A, [B, C]).text,
    "Deleted Stew and 2 recipes that used it: Bowl, Big Bowl",
  );
});

test("weight label", () => {
  assert.equal(weightLabel({ portion_g: 225 }, false), "225 g");
  assert.equal(weightLabel({ portion_g: 225 }, true), "225 g (est.)");
  assert.equal(weightLabel({ portion_g: 0 }, false), "0 g");
  assert.equal(weightLabel({ portion_g: null }, true), null);
  assert.equal(weightLabel({}, false), null);
});

test("withoutRecipes removes by id", () => {
  assert.deepEqual(withoutRecipes([A, B, C], [A, C]), [B]);
  assert.deepEqual(withoutRecipes([A], []), [A]);
});

const LIST = [
  {
    id: "1",
    name: "Pinto Bean Stew",
    description: "Slow cooked",
    ingredients: [{ amount: "200g", item: "pinto beans" }],
  },
  {
    id: "2",
    name: "Tomato Soup",
    description: "A smooth starter",
    ingredients: [{ amount: "4", item: "Tomatoes" }],
  },
  { id: "3", name: "Rice Bowl", description: "", ingredients: undefined },
];
const names = (list) => list.map((r) => r.name);

test("filterRecipes: every word must be in the name, description or ingredients, in any case", () => {
  assert.equal(filterRecipes(LIST, ""), LIST);
  assert.equal(filterRecipes(LIST, "   "), LIST);
  assert.equal(filterRecipes(LIST, undefined), LIST);
  assert.deepEqual(names(filterRecipes(LIST, "SOUP")), ["Tomato Soup"]);
  assert.deepEqual(names(filterRecipes(LIST, "bean")), ["Pinto Bean Stew"]); // name and ingredient
  assert.deepEqual(names(filterRecipes(LIST, "smooth")), ["Tomato Soup"]); // description
  assert.deepEqual(names(filterRecipes(LIST, "tomatoes")), ["Tomato Soup"]); // ingredient only
  assert.deepEqual(names(filterRecipes(LIST, "tomato soup")), ["Tomato Soup"]);
  assert.deepEqual(names(filterRecipes(LIST, "  rice   bowl ")), ["Rice Bowl"]);
  assert.deepEqual(names(filterRecipes(LIST, "bean soup")), []); // both words must match
  assert.deepEqual(names(filterRecipes(LIST, "o")), names(LIST)); // all contain an o
  assert.deepEqual(filterRecipes([], "x"), []);
});

test("volumeLabel: '250 ml' for a liquid with a volume, else nothing", () => {
  assert.equal(volumeLabel({ form: "liquid", portion_ml: 250 }), "250 ml");
  assert.equal(volumeLabel({ form: "liquid", portion_ml: 187.5 }), "187.5 ml");
  assert.equal(volumeLabel({ form: "liquid" }), null);
  assert.equal(volumeLabel({ form: "liquid", portion_ml: 0 }), null);
  assert.equal(volumeLabel({ form: "solid", portion_ml: 250 }), null);
  assert.equal(volumeLabel({ portion_ml: 250 }), null);
});
