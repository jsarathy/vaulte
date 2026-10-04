// tests/weightPlan.test.mjs — weight plan projection (pinned before the Fix 26 refactor)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAN_CONFIG as C,
  planAnchorPoints,
  projectedWeightAt,
  cmPerKgAt,
  waistForWeight,
  buildProjectionSeries,
  deriveMilestones,
} from "../src/constants/weightPlan.js";

test("anchor points: week 0 prepended, sorted, duplicates and invalid weeks dropped", () => {
  assert.equal(planAnchorPoints(C).length, 11);
  const pts = planAnchorPoints({
    startDate: "2026-01-01",
    startWeightKg: 80,
    planAnchors: [
      { week: 2, weightKg: 78 },
      { week: 2, weightKg: 77 },
      { week: -1, weightKg: 90 },
      { week: "x", weightKg: 1 },
      { week: 1, weightKg: 79 },
    ],
  });
  assert.deepEqual(
    pts.map((p) => [p.week, p.weightKg]),
    [
      [0, 80],
      [1, 79],
      [2, 78],
    ],
  );
  assert.deepEqual(planAnchorPoints({}), []);
});

test("projected weight: start, interpolated, outside the curve", () => {
  assert.equal(projectedWeightAt(C, "2026-08-16"), 83.75);
  assert.equal(projectedWeightAt(C, "2026-08-30"), 81.08);
  assert.equal(projectedWeightAt(C, "2026-08-01"), null);
  assert.equal(projectedWeightAt(C, "2027-08-01"), null);
});

test("waist rate and waist for weight", () => {
  assert.equal(cmPerKgAt(C, 83.75), 1.35);
  assert.equal(cmPerKgAt(C, 65), 0.86);
  assert.equal(+cmPerKgAt(C, 74.375).toFixed(3), 1.105);
  assert.equal(waistForWeight(C, 83.75), 110);
  assert.equal(waistForWeight(C, 74.5), 98.6);
  assert.equal(waistForWeight(C, 65), 89.3);
  assert.equal(cmPerKgAt({}, 70), null);
  assert.equal(waistForWeight(C, NaN), null);
});

test("weekly projection series: week 0 to the last anchor", () => {
  const s = buildProjectionSeries(C);
  assert.equal(s.length, 41);
  assert.deepEqual([s[0].date, s[0].projected, s[0].waist], ["2026-08-16", 83.75, 110]);
  assert.deepEqual([s[2].date, s[2].projected, s[2].waist], ["2026-08-30", 81.08, 106.5]);
  assert.deepEqual([s[40].date, s[40].projected, s[40].waist], ["2027-05-23", 65, 89.3]);
  assert.deepEqual(buildProjectionSeries({}), []);
});

const summary = (ms) => ms.map((m) => [m.date.replace("Sept", "Sep"), m.weight, m.note, m.phase]);

test("milestones: start, -4 kg, -8 kg, target zone, plan end", () => {
  assert.deepEqual(summary(deriveMilestones(C)), [
    ["16 Aug 2026", "83.8 kg", "START", "Phase 1"],
    ["06 Sep 2026", "79.7 kg", "-4 kg", "Phase 1"],
    ["04 Oct 2026", "75.5 kg", "-8 kg", "Phase 1"],
    ["08 Nov 2026", "71.7 kg", "TARGET ZONE", "Phase 3"],
    ["23 May 2027", "65.0 kg", "Plan end, wk 40", "Phase 3"],
  ]);
});

test("milestones: no target, target only at plan end, empty plan", () => {
  const withoutTarget = [
    ["16 Aug 2026", "83.8 kg", "START", "Phase 1"],
    ["06 Sep 2026", "79.7 kg", "-4 kg", "Phase 1"],
    ["04 Oct 2026", "75.5 kg", "-8 kg", "Phase 1"],
    ["23 May 2027", "65.0 kg", "Plan end, wk 40", "Phase 3"],
  ];
  assert.deepEqual(
    summary(deriveMilestones({ ...C, targetWeightMaxKg: undefined })),
    withoutTarget,
  );
  assert.deepEqual(summary(deriveMilestones({ ...C, targetWeightMaxKg: 65 })), withoutTarget);
  assert.deepEqual(deriveMilestones({}), []);
});
