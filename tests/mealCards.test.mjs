// tests/mealCards.test.mjs — the Daily log's meal cards (src/lib/mealCards.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MACRO_KEYS,
  COLUMN_HEADS,
  parseCollapsed,
  isClosed,
  toggled,
  mealSummary,
  subtotalText,
  itemFigures,
  itemLink,
} from "../src/lib/mealCards.js";

test("open / closed state", () => {
  assert.deepEqual(parseCollapsed('{"a":false}'), { a: false });
  assert.deepEqual(parseCollapsed(null), {});
  assert.deepEqual(parseCollapsed(""), {});
  assert.deepEqual(parseCollapsed("{oops"), {});
  const c = { a: false, b: true };
  assert.equal(isClosed(c, "a"), false);
  assert.equal(isClosed(c, "b"), true);
  assert.equal(isClosed(c, "new"), true);
  assert.deepEqual(toggled(c, "a"), { a: true, b: true });
  assert.deepEqual(toggled(c, "new"), { a: false, b: true, new: false });
  assert.deepEqual(c, { a: false, b: true }); // not changed in place
});

test("a card's subtotals and kind", () => {
  assert.deepEqual(MACRO_KEYS, ["kcal", "fat", "carbs", "sugar", "fibre", "net_carbs", "protein"]);
  assert.deepEqual(COLUMN_HEADS, [
    "Item",
    "kcal",
    "Fat",
    "Carbs",
    "Sugar",
    "Fibre",
    "Net C",
    "Prot",
    "",
  ]);
  const items = [
    { kcal: 100, fat: 1, carbs: 2, sugar: 3, fibre: 4, net_carbs: 5, protein: 6 },
    { kcal: 50.5, protein: 1 },
  ];
  const m = mealSummary({ items });
  assert.deepEqual(m.subtotals, [150.5, 1, 2, 3, 4, 5, 7]);
  assert.equal(m.hasItems, true);
  assert.equal(m.isExercise, false);
  assert.equal(m.items, items);
  assert.equal(mealSummary({ is_exercise: 1, items: [] }).isExercise, 1);
  assert.equal(mealSummary({ items: [{}] }).hasItems, true);
  assert.equal(mealSummary({ items: [{ is_exercise: 1 }] }).isExercise, true);
  const empty = mealSummary({});
  assert.deepEqual(empty.items, []);
  assert.equal(empty.hasItems, false);
  assert.deepEqual(empty.subtotals, [0, 0, 0, 0, 0, 0, 0]);
});

test("cell text, figures and links", () => {
  assert.equal(subtotalText(330.26, 0, true), "330.3");
  assert.equal(subtotalText(3.55, 3, true), "3.5g");
  assert.equal(subtotalText(0, 1, true), "0g");
  assert.equal(subtotalText(5, 1, false), "—");
  assert.deepEqual(
    itemFigures({ kcal: 1, fat: 2, carbs: 3, sugar: 4, fibre: 5, net_carbs: 6, protein: 7 }),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(itemFigures({ kcal: 80 }), [80, 0, 0, 0, 0, 0, 0]);
  const recipes = [{ name: "Soup" }, { name: "Stew" }];
  assert.deepEqual(itemLink({ is_exercise: 1, polar_session_id: "s" }, recipes), { polar: true });
  assert.equal(itemLink({ polar_session_id: "s" }, recipes), null);
  assert.equal(itemLink({ is_exercise: 1 }, recipes), null);
  assert.deepEqual(itemLink({ recipe_name: "Stew" }, recipes), { recipe: recipes[1] });
  assert.equal(itemLink({ recipe_name: "Gone" }, recipes), null);
  assert.deepEqual(
    itemLink({ is_exercise: 1, polar_session_id: "s", recipe_name: "Soup" }, recipes),
    {
      polar: true,
    },
  );
});
