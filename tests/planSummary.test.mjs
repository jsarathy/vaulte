// tests/planSummary.test.mjs — the Plan Specifications card when not editing (Fix 26 PR 23). The
// card on screen is pinned by tests/ui/weight-plan-view.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bmiOf,
  vo2Band,
  personalStats,
  curveSummary,
  planMilestones,
  phaseBadge,
} from "../src/lib/planSummary.js";

const cfg = {
  age: 60,
  sex: "m",
  heightCm: 165,
  startWeightKg: 83.75,
  startDate: "2026-08-16",
  targetWeightMinKg: 70,
  targetWeightMaxKg: 72,
  vo2max: 33,
  cumLossBaselineKg: 86.45,
  maintenanceCaloriesKcal: 2136,
  planAnchors: [
    { week: 4, weightKg: 79 },
    { week: 8, weightKg: 75 },
  ],
};

test("BMI and VO₂ bands", () => {
  assert.equal(bmiOf(83.75, 165), "30.8");
  assert.equal(bmiOf(70, 170), "24.2");
  assert.equal(vo2Band(34.9), "Fair");
  assert.equal(vo2Band(35), "Good");
  assert.equal(vo2Band(44.9), "Good");
  assert.equal(vo2Band(45), "Excellent");
});

test("Personal Stats", () => {
  assert.deepEqual(personalStats(cfg), [
    ["Age", "60 yr"],
    ["Sex", "Male"],
    ["Height", "165 cm"],
    ["Start Weight", "83.8 kg"],
    ["Start BMI", "30.8"],
    ["Target", "70–72 kg"],
    ["Target BMI", "25.7–26.4"],
    ["VO₂ Max", "33 — Fair"],
    ["Cum-loss base", "86.45 kg"],
  ]);
  const f = personalStats({ ...cfg, sex: "f", cumLossBaselineKg: "x" });
  assert.deepEqual(f[1], ["Sex", "Female"]);
  assert.deepEqual(personalStats({ ...cfg, sex: undefined })[1], ["Sex", "Female"]); // only "m" is Male
  assert.deepEqual(f[8], ["Cum-loss base", "86.45 kg"]);
});

test("Projection Curve", () => {
  assert.deepEqual(curveSummary(cfg), [
    ["Anchors", "3 points"],
    ["Plan length", "8 weeks"],
    ["End weight", "75.0 kg"],
    ["Maintenance", "2,136 kcal"],
    ["Sync From", "2026-08-16"],
  ]);
  assert.deepEqual(
    curveSummary({ ...cfg, planAnchors: undefined, maintenanceCaloriesKcal: 0, startDate: "" }),
    [
      ["Anchors", "1 points"],
      ["Plan length", "—"],
      ["End weight", "—"],
      ["Maintenance", "0 kcal"],
      ["Sync From", "—"],
    ],
  );
  assert.deepEqual(curveSummary({ ...cfg, syncFromDate: "2026-09-01" })[4], [
    "Sync From",
    "2026-09-01",
  ]);
});

test("milestones and badges", () => {
  assert.deepEqual(
    planMilestones(cfg).map((m) => [m.note, m.phase]),
    [
      ["START", "Phase 1"],
      ["-4 kg", "Phase 1"],
      ["-8 kg", "Phase 1"],
      ["Plan end, wk 8", "Phase 3"],
    ],
  );
  assert.deepEqual(planMilestones({}), []);
  const broken = {
    ...cfg,
    planAnchors: [
      {
        get week() {
          throw new Error("unreadable");
        },
      },
    ],
  };
  assert.deepEqual(planMilestones(broken), []); // can't be worked out
  assert.deepEqual(phaseBadge("Phase 1"), { label: "P1", background: "#E8F5E9", color: "#2E7D32" });
  assert.deepEqual(phaseBadge("Phase 3"), { label: "P3", background: "#E3F2FD", color: "#185FA5" });
  assert.deepEqual(phaseBadge("RESET"), { label: "RST", background: "#FFF3CD", color: "#795548" });
  assert.deepEqual(phaseBadge("Phase 2"), {
    label: "RST",
    background: "#E8F5E9",
    color: "#2E7D32",
  });
});
