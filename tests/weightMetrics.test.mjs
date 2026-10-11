// tests/weightMetrics.test.mjs — src/lib/weightMetrics.js: the Weight tab's metric names, units and notes (Fix 77)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metricHeading,
  metricInfo,
  metricLabel,
  metricTabs,
  metricUnit,
} from "../src/lib/weightMetrics.js";

// Renpho field → [name, unit]
const KNOWN = {
  bmi: ["BMI", ""],
  bodyfat: ["Body fat", "%"],
  bodyFat: ["Body fat", "%"],
  water: ["Body water", "%"],
  bodyWater: ["Body water", "%"],
  muscle: ["Muscle mass", "kg"],
  muscleMass: ["Muscle mass", "kg"],
  skeletalMuscle: ["Skeletal muscle", "%"],
  sinew: ["Skeletal muscle", "%"],
  bone: ["Bone mass", "kg"],
  boneMass: ["Bone mass", "kg"],
  bmr: ["BMR", "kcal"],
  visfat: ["Visceral fat", ""],
  visceralFat: ["Visceral fat", ""],
  subfat: ["Subcutaneous fat", "%"],
  subcutaneousFat: ["Subcutaneous fat", "%"],
  protein: ["Protein", "%"],
  bodyage: ["Metabolic age", "yrs"],
  bodyAge: ["Metabolic age", "yrs"],
  fatFreeWeight: ["Fat-free weight", "kg"],
  lbm: ["Lean body mass", "kg"],
  heartRate: ["Heart rate", "bpm"],
  cardiacIndex: ["Cardiac index", ""],
};

test("every known Renpho field has its name and unit", () => {
  for (const [key, [label, unit]] of Object.entries(KNOWN)) {
    assert.equal(metricLabel(key), label, key);
    assert.equal(metricUnit(key), unit, key);
  }
});

test("an unknown field gets a readable name and no unit", () => {
  assert.equal(metricLabel("fat_mass"), "Fat mass");
  assert.equal(metricLabel("newMetricName"), "New Metric Name");
  assert.equal(metricLabel("fat_mass_total"), "Fat mass total"); // only the first letter is capitalised
  assert.equal(metricLabel("ab"), "Ab");
  assert.equal(metricUnit("fat_mass"), "");
  assert.equal(metricUnit("weight"), "");
});

test("heading: name and unit; weight is in kg; no brackets when there is no unit", () => {
  assert.equal(metricHeading("bodyfat"), "Body fat (%)");
  assert.equal(metricHeading("bmr"), "BMR (kcal)");
  assert.equal(metricHeading("bmi"), "BMI");
  assert.equal(metricHeading("weight"), "Weight (kg)");
  assert.equal(metricHeading("fat_mass"), "Fat mass");
});

const NOTED = [
  ["weight", /Total body weight.*planned trajectory/],
  ["bmi", /Body Mass Index/],
  ["bodyfat", /bioelectrical impedance/],
  ["water", /Share of body weight that is water/],
  ["muscle", /weight of muscle/],
  ["skeletalMuscle", /attached to bone/],
  ["bone", /bone mineral/],
  ["bmr", /Basal metabolic rate/],
  ["visfat", /Visceral fat.*1-59 scale/],
  ["subfat", /just under your skin/],
  ["protein", /made up of protein/],
  ["bodyage", /Metabolic age/],
  ["fatFreeWeight", /isn't fat/],
  ["lbm", /Lean body mass/],
  ["heartRate", /Resting heart rate/],
  ["cardiacIndex", /how hard your heart works/],
];

test("each metric with a note shows its own text", () => {
  for (const [key, pattern] of NOTED) assert.match(metricInfo(key), pattern, key);
  assert.equal(new Set(NOTED.map(([key]) => metricInfo(key))).size, NOTED.length);
});

test("a note is found by the lower-case key; an unknown field gets a generic line", () => {
  assert.equal(metricInfo("bodyFat"), metricInfo("bodyfat"));
  assert.equal(metricInfo("BMR"), metricInfo("bmr"));
  assert.equal(metricInfo("heartRate"), metricInfo("heartRate"));
  assert.equal(metricInfo("fat_mass"), "Fat mass, as reported by your Renpho scale.");
  assert.equal(metricInfo("bodyWater"), "Body water, as reported by your Renpho scale.");
});

test("metricTabs: Weight first, then each field with data by name; hidden fields get no tab", () => {
  const log = [
    { renpho: { bodyfat: 20, weight: 90, fc: 1, isauto: 1, tw: 5, wc: 3, bmi: 28 } },
    { renpho: { bmi: 27, muscle: 40, WEIGHT: 90, Fc: 2 } },
    { date: "no renpho data" },
    { renpho: { zeta_thing: 1, alpha_thing: 2 } },
  ];
  assert.deepEqual(metricTabs(log), [
    ["weight", "Weight"],
    ["alpha_thing", "Alpha thing"],
    ["bmi", "BMI"],
    ["bodyfat", "Body fat"],
    ["muscle", "Muscle mass"],
    ["zeta_thing", "Zeta thing"],
  ]);
  assert.deepEqual(metricTabs([]), [["weight", "Weight"]]);
  assert.deepEqual(metricTabs([{ x: 1 }]), [["weight", "Weight"]]);
});
