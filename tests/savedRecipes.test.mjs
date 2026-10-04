// tests/savedRecipes.test.mjs — Saved Recipes list texts (Fix 26 PR 9)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteConfirmText,
  deletedNotice,
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
