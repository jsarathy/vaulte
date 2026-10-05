// tests/dayBudget.test.mjs — the Daily log's energy budget (src/lib/dayBudget.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bmr,
  activityTier,
  dayBudget,
  macroPills,
  leftParts,
  summaryCards,
  adjacentDay,
} from "../src/lib/dayBudget.js";

const CALC = { sex: "m", age: 60, height: 165, weight: 84, protein: 1.4, fatPct: 30 };
const totals = (t = {}) => ({
  foodKcal: 0,
  exerciseBurned: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  net_carbs: 0,
  ...t,
});

test("resting energy and activity tiers", () => {
  assert.equal(bmr(CALC), 1576.25);
  assert.equal(bmr({ ...CALC, sex: "f" }), 1410.25);
  assert.equal(bmr({ sex: "m", weight: 1, height: 0, age: 0 }), 15);
  assert.equal(bmr({ sex: "m", weight: 0, height: 1, age: 0 }), 11.25);
  assert.equal(bmr({ sex: "m", weight: 0, height: 0, age: 1 }), 0);
  const tier = (b) => activityTier(b).label;
  assert.deepEqual([0, -5, 0.1, 150, 150.1, 300, 300.1].map(tier), [
    "Sedentary",
    "Sedentary",
    "Lightly Active",
    "Lightly Active",
    "Moderately Active",
    "Moderately Active",
    "Very Active",
  ]);
});

test("the day's budget", () => {
  const b = dayBudget(totals({ foodKcal: 3000, exerciseBurned: 100 }), 250.5, CALC);
  assert.equal(b.burned, 350.5);
  assert.equal(b.tier.label, "Very Active");
  assert.equal(b.tdee, 2719); // 1,576.25 × 1.725 = 2,719.03
  assert.deepEqual(b.target, {
    protein_g: 118,
    fat_g: 91,
    carbs_g: 357,
    fibre_g: 30,
    net_carbs: 327,
  });
  assert.equal(b.net, 2649.5);
  assert.equal(b.left, 69.5);
  assert.equal(b.pct, 97);
  assert.equal(dayBudget(totals({ foodKcal: 1892 }), 0, CALC).tdee, 1892); // 1,891.5 rounds up
  assert.equal(dayBudget(totals({ foodKcal: 4000 }), 0, CALC).pct, 100);
  assert.equal(dayBudget(totals({ exerciseBurned: 150 }), 0, CALC).pct, -7);
  assert.equal(dayBudget(totals(), 0, { ...CALC, fatPct: 45 }).target.fat_g, 95);
  assert.equal(dayBudget(totals(), 0, { ...CALC, protein: 2 }).target.protein_g, 168);
  assert.equal(dayBudget(totals(), 0, { ...CALC, weight: 70 }).target.protein_g, 98);
});

test("macro pills, what's left", () => {
  const t = totals({ protein: 118, fat: 91.04, carbs: 0, net_carbs: 400 }); // carbs, not net
  assert.deepEqual(macroPills(t, { protein_g: 118, fat_g: 91, carbs_g: 357 }), [
    { label: "Protein", grams: 118, over: false, tone: "blue" },
    { label: "Fat", grams: 91, over: true, tone: "amber" },
    { label: "Carbs", grams: "0", over: false, tone: "amber" },
  ]);
  assert.deepEqual(leftParts(1743.4), ["-", "1,743"]);
  assert.deepEqual(leftParts(0), ["-", "0"]);
  assert.deepEqual(leftParts(-14), ["+", "14"]);
  assert.deepEqual(leftParts(-0.4), ["+", "0"]);
});

test("summary cards", () => {
  const b = { burned: 457.4, target: { protein_g: 118, carbs_g: 357 } };
  const t = totals({ foodKcal: 3000.4, exerciseBurned: 100.4, protein: 140.26, net_carbs: 380 });
  assert.deepEqual(summaryCards(t, b, 357.3), [
    { label: "Consumed", value: "3,000", note: "457 kcal burned (incl. 357 Apple)", warn: false },
    { label: "Protein", value: "140.3g", note: "target 118g", warn: false },
    { label: "Net carbs", value: "380g", note: "+23g over", warn: true },
    { label: "Fat burned", value: "0g", note: "100 kcal exercise", warn: false },
  ]);
  const cards = summaryCards(totals({ net_carbs: 357, fatBurnedG: 12.34 }), { ...b, burned: 0 }, 0);
  assert.equal(cards[0].note, "0 kcal burned");
  assert.deepEqual(cards[2], { label: "Net carbs", value: "357g", note: "0g left", warn: false });
  assert.deepEqual(cards[3], {
    label: "Fat burned",
    value: "12.3g",
    note: "no exercise logged",
    warn: false,
  });
  assert.equal(summaryCards(totals({ net_carbs: 300.04 }), b, 0)[2].note, "57g left");
  assert.equal(summaryCards(totals({ net_carbs: 357.26 }), b, 0)[2].note, "+0.3g over");
});

test("the day before / after", () => {
  const days = [{ date: "2026-10-04" }, { date: "2026-10-03" }, { date: "2026-10-01" }];
  assert.equal(adjacentDay(days, "2026-10-04", 1), "2026-10-03");
  assert.equal(adjacentDay(days, "2026-10-03", 1), "2026-10-01");
  assert.equal(adjacentDay(days, "2026-10-01", 1), null);
  assert.equal(adjacentDay(days, "2026-10-03", -1), "2026-10-04");
  assert.equal(adjacentDay(days, "2026-10-04", -1), null);
  // a day that isn't in the list: older goes to the newest, newer goes nowhere
  assert.equal(adjacentDay(days, "2026-09-01", 1), "2026-10-04");
  assert.equal(adjacentDay(days, "2026-09-01", -1), null);
});
