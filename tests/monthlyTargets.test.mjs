// tests/monthlyTargets.test.mjs — monthly targets form ↔ Firestore shape (Fix 26)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_TARGETS,
  monthKeyOf,
  fromTargetDoc,
  toTargetDoc,
} from "../src/lib/monthlyTargets.js";

test("month key is YYYY-MM from a 0-based month", () => {
  assert.equal(monthKeyOf(2026, 9), "2026-10");
  assert.equal(monthKeyOf(2027, 0), "2027-01");
});

test("doc → form: missing or null values become blank", () => {
  assert.deepEqual(fromTargetDoc({}), EMPTY_TARGETS);
  assert.deepEqual(fromTargetDoc({ weightKg: 80.5, golf: null, gym: 0 }), {
    weightKg: 80.5,
    waistCm: "",
    gym: 0,
    golf: "",
    sleepHrs: "",
  });
});

test("form → doc: numbers, null for blanks, month and tolerances alongside", () => {
  const d = toTargetDoc("2026-10", {
    weightKg: "79.8",
    waistCm: "",
    gym: "12",
    golf: "x",
    sleepHrs: 7,
  });
  assert.deepEqual(
    { ...d, updated_at: undefined },
    {
      month: "2026-10",
      tolerance: { weightKg: 0.2, waistCm: 1 },
      updated_at: undefined,
      weightKg: 79.8,
      waistCm: null,
      gym: 12,
      golf: null,
      sleepHrs: 7,
    },
  );
  assert.ok(!Number.isNaN(Date.parse(d.updated_at)));
});
