// tests/referenceDiet.test.mjs — src/lib/referenceDiet.js (Fix 26 PR 40): Mifflin-St Jeor BMR,
// the activity rows, and the Compare slots (which day a slot shows; swapping one out).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bmr,
  activityRows,
  MACRO_ROWS,
  findDay,
  slotDay,
  swapSlot,
} from "../src/lib/referenceDiet.js";

test("bmr: Mifflin-St Jeor, +5 for men, −161 for women", () => {
  assert.equal(bmr({ sex: "m", age: 50, height: 180, weight: 80 }), 1680);
  assert.equal(bmr({ sex: "f", age: 50, height: 180, weight: 80 }), 1514);
  assert.equal(bmr({ sex: "f", age: 30, height: 170, weight: 60 }), 1351.5); // unrounded
  assert.equal(bmr({ sex: "x", age: 0, height: 0, weight: 0 }), -161); // anything else: female
});

test("activityRows: one per level, TDEE rounded, macros from the fat share", () => {
  const rows = activityRows(1680, { weight: 80, proteinPerKg: 1.2, fatPct: 30 });
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((r) => [r.label, r.td]),
    [
      ["Sedentary", 2016],
      ["Lightly Active", 2310],
      ["Moderately Active", 2604],
      ["Very Active", 2898],
      ["Extremely Active", 3192],
    ],
  );
  assert.equal(rows[0].desc, "Desk job, little/no exercise");
  assert.deepEqual(rows[0].macros, {
    protein_g: 96,
    fat_g: 67,
    carbs_g: 257,
    fibre_g: 30,
    net_carbs: 227,
  });
  assert.equal(rows[4].macros.carbs_g, 464); // 463.5 rounds up
  const r = activityRows(1351.5, { weight: 60, proteinPerKg: 2, fatPct: 40 });
  assert.equal(r[0].td, 1622); // 1621.8
  assert.deepEqual([r[0].macros.protein_g, r[0].macros.fat_g, r[0].macros.carbs_g], [120, 72, 124]);
});

test("MACRO_ROWS: label and totals key, in display order", () => {
  assert.deepEqual(MACRO_ROWS, [
    ["Fat", "fat"],
    ["Carbs", "carbs"],
    ["Net C", "net_carbs"],
    ["Fibre", "fibre"],
    ["Protein", "protein"],
    ["Sugar", "sugar"],
  ]);
});

const D1 = { date: "2026-10-01", meals: [] };
const D2 = { date: "2026-10-02", meals: [] };
const DAYS = [D1, D2];

test("findDay / slotDay: the live day for a date, else the stored one, else null", () => {
  assert.equal(findDay(DAYS, "2026-10-02"), D2);
  assert.equal(findDay(DAYS, "2026-09-30"), null);
  assert.equal(findDay(DAYS, null), null);
  assert.equal(findDay(DAYS, ""), null);
  const stored = { date: "2026-10-01", meals: [{ id: "old" }] };
  assert.equal(slotDay("2026-10-01", DAYS, stored), D1); // live wins
  assert.equal(slotDay("2026-09-30", DAYS, stored), stored); // unknown date: stored
  assert.equal(slotDay(null, DAYS, null), null);
});

test("swapSlot: new arrays, the slot's date and its day (null when unknown)", () => {
  const slots = ["2026-10-01", null, null];
  const data = [D1, null, null];
  const next = swapSlot({ slots, data }, 1, { date: "2026-10-02", allDays: DAYS });
  assert.deepEqual(next, { slots: ["2026-10-01", "2026-10-02", null], data: [D1, D2, null] });
  assert.notEqual(next.slots, slots);
  assert.notEqual(next.data, data);
  assert.deepEqual(slots, ["2026-10-01", null, null]); // inputs untouched
  const gone = swapSlot(next, 0, { date: "2026-09-30", allDays: DAYS });
  assert.deepEqual(gone, { slots: ["2026-09-30", "2026-10-02", null], data: [null, D2, null] });
});
