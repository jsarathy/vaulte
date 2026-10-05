// tests/planEdits.test.mjs — editing the weight plan (Fix 26 PR 24). The editors on screen are
// pinned by tests/ui/weight-plan-edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  numberField,
  anchorsOf,
  syncFromValue,
  withField,
  withAnchorFields,
  withNewAnchor,
  withoutAnchor,
  anchorDate,
} from "../src/lib/planEdits.js";

test("fields", () => {
  assert.equal(numberField("61.5"), 61.5);
  assert.equal(numberField(""), 0);
  assert.equal(numberField("x"), 0);
  assert.equal(syncFromValue({ syncFromDate: "b", startDate: "a" }), "b");
  assert.equal(syncFromValue({ syncFromDate: "", startDate: "a" }), "a");
  assert.equal(syncFromValue({}), "");
  const plan = { age: 60, sex: "m" };
  assert.deepEqual(withField(plan, "age", 61), { age: 61, sex: "m" });
  assert.deepEqual(plan, { age: 60, sex: "m" });
});

test("anchors", () => {
  const plan = {
    startWeightKg: 84,
    planAnchors: [
      { week: 4, weightKg: 80 },
      { week: 8, weightKg: 77 },
    ],
  };
  assert.deepEqual(anchorsOf({ planAnchors: "none" }), []);
  assert.deepEqual(anchorsOf({}), []);
  assert.deepEqual(withAnchorFields(plan, 1, { week: 10 }).planAnchors, [
    { week: 4, weightKg: 80 },
    { week: 10, weightKg: 77 },
  ]);
  assert.deepEqual(withAnchorFields({}, 0, { week: 2 }).planAnchors, [{ week: 2 }]);
  assert.deepEqual(withNewAnchor(plan).planAnchors.at(-1), { week: 12, weightKg: 77 });
  assert.deepEqual(withNewAnchor({ startWeightKg: 84 }).planAnchors, [{ week: 4, weightKg: 84 }]);
  assert.deepEqual(
    withNewAnchor({ startWeightKg: 84, planAnchors: [{ week: 0, weightKg: 0 }] }).planAnchors[1],
    {
      week: 4,
      weightKg: 84,
    },
  );
  assert.deepEqual(withNewAnchor({ planAnchors: [{ week: "x" }] }).planAnchors[1], {
    week: 4,
    weightKg: 0,
  });
  assert.deepEqual(withoutAnchor(plan, 0).planAnchors, [{ week: 8, weightKg: 77 }]);
  assert.deepEqual(withoutAnchor({}, 0).planAnchors, []);
  assert.equal(plan.planAnchors.length, 2); // untouched
});

test("anchor dates", () => {
  assert.equal(anchorDate("2026-08-16", 4), "13 Sept 26");
  assert.equal(anchorDate("2026-08-16T08:00", "0"), "16 Aug 26");
  assert.equal(anchorDate("2026-08-16", 52), "15 Aug 27");
  assert.equal(anchorDate("2026-08-09", 4), "06 Sept 26");
  // counted from midday, so a clock change in between never moves the day
  const tz = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    assert.equal(anchorDate("2026-10-18", 4), "15 Nov 26");
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
  assert.equal(anchorDate("", 4), "—");
  assert.equal(anchorDate(undefined, 4), "—");
  assert.equal(anchorDate("2026-08-16", undefined), "—");
  assert.equal(anchorDate("2026-08-16", "x"), "—");
});
