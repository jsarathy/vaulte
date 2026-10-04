// tests/recipePortion.test.mjs — the "How much?" box for a saved recipe (Fix 26 PR 5)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseQty,
  portionWeight,
  localFactor,
  scaleMacros,
  amountHeading,
  amountSuffix,
  portionView,
  baseHeading,
  claudeHint,
  calcErrorText,
  formItemFor,
} from "../src/lib/recipePortion.js";

const STEW = { name: "Stew", portion_g: "225", nutrition: { kcal: 338, fat: 10.04 } };
const BARE = { name: "Soup", nutrition: { kcal: 100 } };

test("quantity: blank, zero or text count as 1", () => {
  assert.equal(parseQty("2.5"), 2.5);
  for (const t of ["", "0", "abc", undefined]) assert.equal(parseQty(t), 1);
});

test("portion weight: positive number or null", () => {
  assert.equal(portionWeight(STEW), 225);
  assert.equal(portionWeight(BARE), null);
  assert.equal(portionWeight({ portion_g: 0 }), null);
});

test("local factor: portions always; g/oz need a Wt/portion; ml never", () => {
  assert.equal(localFactor(BARE, 2, "portion"), 2);
  assert.equal(localFactor(STEW, 150, "g"), 150 / 225);
  assert.equal(localFactor(STEW, 2, "oz"), (2 * 28.3495) / 225);
  assert.equal(localFactor(STEW, 100, "ml"), null);
  assert.equal(localFactor(BARE, 150, "g"), null);
});

test("scaleMacros: every macro, 1 dp, missing → 0", () => {
  assert.deepEqual(scaleMacros(STEW.nutrition, 2), {
    kcal: 676,
    fat: 20.1,
    sat_fat: 0,
    carbs: 0,
    sugar: 0,
    fibre: 0,
    net_carbs: 0,
    protein: 0,
  });
  assert.equal(scaleMacros({ kcal: 123.456 }, 1).kcal, 123.5);
  assert.equal(scaleMacros(undefined, 3).kcal, 0);
});

test("labels: plural portions; unit with/without a space", () => {
  assert.equal(amountHeading(1, "portion"), "1 portion of");
  assert.equal(amountHeading(2.5, "portion"), "2.5 portions of");
  assert.equal(amountHeading(0.5, "portion"), "0.5 portions of");
  assert.equal(amountHeading(150, "g"), "150 g of");
  assert.equal(amountSuffix(1, "portion"), "(1 portion)");
  assert.equal(amountSuffix(2, "portion"), "(2 portions)");
  assert.equal(amountSuffix(150, "g"), "(150g)");
});

test("portionView: local scaling, or Claude's result when not local", () => {
  const local = portionView(STEW, { qtyText: "150", unit: "g", claudeResult: { kcal: 1 } });
  assert.equal(local.isLocal, true);
  assert.equal(local.scaled.kcal, 225.3);
  assert.equal(local.heading, "150 g of");
  assert.equal(local.suffix, "(150g)");
  const remote = portionView(BARE, { qtyText: "", unit: "g", claudeResult: null });
  assert.deepEqual(
    { qty: remote.qty, isLocal: remote.isLocal, scaled: remote.scaled },
    { qty: 1, isLocal: false, scaled: null },
  );
  const result = { kcal: 5 };
  assert.equal(
    portionView(BARE, { qtyText: "2", unit: "ml", claudeResult: result }).scaled,
    result,
  );
});

test("base heading, Claude hint and error text", () => {
  assert.equal(baseHeading(null, true), "Per serving (base)");
  assert.equal(baseHeading(225, false), "Per serving (base) · 225 g");
  assert.equal(baseHeading(225, true), "Per serving (base) · 225 g (est.)");
  assert.equal(claudeHint("ml"), "Millilitres are worked out by Claude.");
  assert.match(claudeHint("g"), /no Wt\/portion/);
  assert.match(calcErrorText(new Error("boom")), /^Could not calculate \(boom\) — try portions/);
  assert.match(calcErrorText({}), /\(unknown error\)/);
});

test("form item: name + amount; missing macros blank, zero kept", () => {
  assert.deepEqual(formItemFor(STEW, { kcal: 0, fat: 2 }, "(2 portions)"), {
    name: "Stew (2 portions)",
    kcal: 0,
    fat: 2,
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });
});
