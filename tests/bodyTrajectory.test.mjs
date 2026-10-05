// tests/bodyTrajectory.test.mjs — the Body tab's sites and Trajectory series
// (src/lib/bodyMeasures.js, bodySeries in src/lib/trajectoryChart.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY_MEASURES, MEASURE, measureTabs } from "../src/lib/bodyMeasures.js";
import { bodySeries, chartLayout, chartSeries, hasEnough } from "../src/lib/trajectoryChart.js";

const view = { full: false, box: { w: 0, h: 0 } };

test("sites", () => {
  assert.equal(BODY_MEASURES.length, 12);
  assert.deepEqual(measureTabs.slice(0, 3), [
    ["neck", "Neck"],
    ["shoulder", "Shoulder"],
    ["bicepL", "L-Bicep"],
  ]);
  assert.equal(measureTabs.at(-1)[1], "R-Calf");
  assert.equal(MEASURE.abdomen.short, "Abdo");
  assert.match(MEASURE.waist.info, /^At the narrowest point/);
});

test("a site's readings: dated rows with a value, oldest first", () => {
  const log = [
    { date: "2026-09-03", waist: "101.5" },
    { date: "2026-09-01", waist: 102 },
    { date: "2026-09-02", hip: 108 },
    { date: "nope", waist: 99 },
    { date: "2026-09-04", waist: 0 },
  ];
  const s = bodySeries(log, "waist");
  assert.deepEqual(
    s.acts.map((a) => [a.date, a.v]),
    [
      ["2026-09-01", 102],
      ["2026-09-03", 101.5],
      ["2026-09-04", 0],
    ],
  );
  assert.deepEqual(
    { ...s, acts: undefined },
    { isPlan: false, unit: "cm", acts: undefined, avgPts: [], projPts: [], minPad: 0.5 },
  );
  assert.equal(hasEnough(bodySeries(log, "hip")), false);
});

test("scale: 15% of the range above and below, at least 0.5 cm", () => {
  const rows = (a, b) => [
    { date: "2026-09-01", waist: a },
    { date: "2026-09-08", waist: b },
  ];
  const L = chartLayout(bodySeries(rows(100, 90), "waist"), {}, view);
  assert.deepEqual([L.minW, L.maxW], [88.5, 101.5]);
  const flat = chartLayout(bodySeries(rows(100, 100), "waist"), {}, view);
  assert.deepEqual([flat.minW, flat.maxW], [99.5, 100.5]);
  // a Renpho metric keeps its own floor: 1% of the top value
  const renpho = (v) => [
    { date: "2026-09-01", renpho: { muscleMass: v } },
    { date: "2026-09-08", renpho: { muscleMass: v } },
  ];
  const m = chartLayout(chartSeries(renpho(100), "muscleMass", {}), {}, view);
  assert.deepEqual([m.minW, m.maxW], [99, 101]);
  const small = chartLayout(chartSeries(renpho(2), "muscleMass", {}), {}, view);
  assert.deepEqual([small.minW, small.maxW], [1.9, 2.1]);
});
