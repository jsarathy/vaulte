// tests/monthlyTargets.test.mjs — monthly targets form ↔ Firestore shape (Fix 26)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_TARGETS,
  actualKey,
  actualStatus,
  monthKeyOf,
  fromTargetDoc,
  toTargetDoc,
  TARGET_FIELDS,
  monthLabelOf,
} from "../src/lib/monthlyTargets.js";

test("month key is YYYY-MM from a 0-based month", () => {
  assert.equal(monthKeyOf(2026, 9), "2026-10");
  assert.equal(monthKeyOf(2027, 0), "2027-01");
});

test("doc → form: missing or null values become blank", () => {
  assert.deepEqual(fromTargetDoc({}), EMPTY_TARGETS);
  assert.deepEqual(
    fromTargetDoc({ weightKg: 80.5, golf: null, gym: 0, actuals: { weightKg: 81, gym: 3 } }),
    {
      ...EMPTY_TARGETS,
      weightKg: 80.5,
      gym: 0,
      actual_weightKg: 81,
      actual_gym: 3,
    },
  );
});

test("form → doc: numbers, null for blanks, month and tolerances alongside", () => {
  const d = toTargetDoc("2026-10", {
    weightKg: "79.8",
    waistCm: "",
    gym: "12",
    golf: "x",
    sleepHrs: 7,
    [actualKey("weightKg")]: "80.4",
    [actualKey("gym")]: 0,
    [actualKey("golf")]: "",
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
      actuals: { weightKg: 80.4, waistCm: null, gym: 0, golf: null, sleepHrs: null },
    },
  );
  assert.ok(!Number.isNaN(Date.parse(d.updated_at)));
});

test("actual key is the field key with an actual_ prefix", () => {
  assert.equal(actualKey("gym"), "actual_gym");
});

test("status: weight and waist are within the tolerance of the target", () => {
  assert.equal(actualStatus("weightKg", "80", "80.2"), "ok");
  assert.equal(actualStatus("weightKg", "80", "79.8"), "ok");
  assert.equal(actualStatus("weightKg", "80", "80.3"), "off");
  assert.equal(actualStatus("weightKg", "80", "79.7"), "off");
  assert.equal(actualStatus("waistCm", 100, 101), "ok");
  assert.equal(actualStatus("waistCm", 100, 101.5), "off");
});

test("status: sessions and sleep are on target once they reach it", () => {
  assert.equal(actualStatus("gym", "12", "12"), "ok");
  assert.equal(actualStatus("gym", "12", "13"), "ok");
  assert.equal(actualStatus("gym", "12", "11"), "off");
  assert.equal(actualStatus("golf", 4, 0), "off");
  assert.equal(actualStatus("sleepHrs", "7.25", "7"), "off");
});

test("status: blank until both target and actual are set", () => {
  assert.equal(actualStatus("gym", "", "3"), "");
  assert.equal(actualStatus("gym", "12", ""), "");
  assert.equal(actualStatus("weightKg", "x", "80"), "");
});

test("the five form fields: key, label, unit, step and tolerance note (Fix 77)", () => {
  assert.deepEqual(TARGET_FIELDS, [
    { key: "weightKg", label: "Weight", unit: "kg", step: "0.1", tol: "± 0.2 kg" },
    { key: "waistCm", label: "Waist", unit: "cm", step: "0.5", tol: "± 1 cm" },
    { key: "gym", label: "Gym sessions", unit: "", step: "1" },
    { key: "golf", label: "Golf sessions", unit: "", step: "1" },
    { key: "sleepHrs", label: "Sleep (avg)", unit: "hrs", step: "0.25" },
  ]);
});

test("monthLabelOf: short month and year, month counted from 0 (Fix 77)", () => {
  assert.equal(monthLabelOf(2026, 9), "Oct 2026");
  assert.equal(monthLabelOf(2027, 0), "Jan 2027");
  assert.equal(monthLabelOf(2026, 11), "Dec 2026");
});

test("actualStatus: a difference of exactly the tolerance still counts, despite float error (Fix 77)", () => {
  assert.equal(actualStatus("weightKg", "80.4", "80.6"), "ok"); // 80.6 - 80.4 is 0.2000000000000028
  assert.equal(actualStatus("waistCm", "90", "91"), "ok");
  assert.equal(actualStatus("waistCm", "90", "89"), "ok");
  assert.equal(actualStatus("waistCm", "90", "91.1"), "off");
  assert.equal(actualStatus("gym", "8", "8"), "ok"); // sessions: reaching the target is enough
  assert.equal(actualStatus("gym", "8", "7"), "off");
});
