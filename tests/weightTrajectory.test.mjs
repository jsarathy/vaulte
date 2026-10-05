// tests/weightTrajectory.test.mjs — Weight tab: metric tabs, 2-week smoothing, and the Trajectory
// chart's figures (Fix 26 PR 21). The drawing itself is pinned by tests/ui/weight-trajectory.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metricLabel,
  metricUnit,
  metricInfo,
  metricHeading,
  metricTabs,
} from "../src/lib/weightMetrics.js";
import { weightReadings, twoWeekAvgAt, twoWeekLossAt } from "../src/lib/twoWeekWeight.js";
import {
  chartSeries,
  hasEnough,
  chartLayout,
  yAxis,
  xTicks,
  dateLabel,
  linePath,
  targetZone,
  latestX,
  scrollLeftFor,
  hitRadius,
  hoverLabel,
  hoverBox,
} from "../src/lib/trajectoryChart.js";

const DAY = 86400000;
const t = (iso) => Date.parse(iso);

test("metric names, units, notes and tabs", () => {
  assert.equal(metricLabel("bodyfat"), "Body fat");
  assert.equal(metricLabel("fat_mass_v2"), "Fat mass v2");
  assert.equal(metricLabel("fatMassIndex"), "Fat Mass Index");
  assert.equal(metricUnit("bmr"), "kcal");
  assert.equal(metricUnit("mystery"), "");
  assert.match(metricInfo("bmi"), /^Body Mass Index/);
  assert.match(metricInfo("bodyAge"), /^Metabolic age: the age/); // lower-case lookup
  assert.equal(metricInfo("odd_one"), "Odd one, as reported by your Renpho scale.");
  assert.equal(metricHeading("weight"), "Weight (kg)");
  assert.equal(metricHeading("bodyfat"), "Body fat (%)");
  assert.equal(metricHeading("bmi"), "BMI");
  const log = [
    { renpho: { water: 1, Weight: 80, FC: 1, isAuto: 1, tw: 1, wc: 1 } },
    { renpho: { bmi: 1, water: 2, lbm: 3 } },
    {},
  ];
  assert.deepEqual(metricTabs(log), [
    ["weight", "Weight"],
    ["bmi", "BMI"],
    ["water", "Body water"],
    ["lbm", "Lean body mass"],
  ]);
  assert.equal(metricHeading("bodyWater"), "Body water (%)");
});

test("2-week average and loss, by calendar week", () => {
  const log = [
    { date: "2026-09-07", actual: 90 }, // Mon, wk 1
    { date: "2026-09-13", actual: "88" }, // Sun, wk 1
    { date: "2026-09-14", actual: 86 }, // wk 2
    { date: "2026-09-21", actual: 84 }, // wk 3
    { date: "2026-09-30", actual: 82 }, // Wed, wk 4
    { date: "2026-10-01", actual: null },
    { date: "2026-10-02", actual: "x" },
    { actual: 1 },
    null,
  ];
  const r = weightReadings(log);
  assert.deepEqual(
    r.map((x) => x.date),
    ["2026-09-07", "2026-09-13", "2026-09-14", "2026-09-21", "2026-09-30"],
  );
  assert.equal(twoWeekAvgAt(r, "2026-09-13"), 89); // wk 1 only (wk 0 empty)
  assert.equal(twoWeekAvgAt(r, "2026-09-21"), 85); // wk 2 + wk 3 to the date
  assert.equal(twoWeekAvgAt(r, "2026-09-29"), 84); // wk 3 + wk 4 to Tue
  assert.equal(twoWeekAvgAt(r, "nonsense"), null);
  assert.equal(twoWeekAvgAt(r, "2026-08-01"), null);
  // 30 Sep: recent = wk 3–4 (84, 82) = 83; prior = wk 1–2 (90, 88, 86) = 88
  assert.equal(twoWeekLossAt(r, { date: "2026-09-30", actual: 82 }), "5.0");
  assert.equal(twoWeekLossAt(r, { date: "2026-09-21", actual: 84 }), "4.0"); // 89 − 85
  assert.equal(twoWeekLossAt(r, { date: "2026-09-14", actual: 86 }), null); // nothing before wk 1
  assert.equal(twoWeekLossAt(r, { date: "2026-09-30", actual: null }), null);
  assert.equal(twoWeekLossAt(r, { actual: 1 }), null);
  assert.equal(twoWeekLossAt(r, null), null);
  assert.equal(twoWeekLossAt(r, { date: "bad", actual: 1 }), null);
  const gain = [...r, { date: "2026-10-05", actual: 95 }];
  // 5 Oct: recent = wk 4–5 (82, 95) = 88.5; prior = wk 2–3 (86, 84) = 85
  assert.equal(twoWeekLossAt(gain, { date: "2026-10-05", actual: 95 }), "-3.5");
});

const cfg = {
  startDate: "2026-08-16",
  startWeightKg: 84,
  planAnchors: [{ week: 2, weightKg: 82 }],
  targetWeightMinKg: 70,
  targetWeightMaxKg: 72,
};
const log = [
  { date: "2026-08-20", actual: 83.5, renpho: { bmi: 30.6 } },
  { date: "2026-08-18", actual: 83.9, renpho: { bmi: 30.8 } },
  { date: "2026-08-19", actual: null, renpho: { bmi: 30.7 } },
  { date: "bad", actual: 80, renpho: { bmi: 1 } },
];

test("series: weight with plan and 2-wk avg; other metrics on their own", () => {
  const w = chartSeries(log, "weight", cfg);
  assert.equal(w.isPlan, true);
  assert.equal(w.unit, "kg");
  assert.deepEqual(
    w.acts.map((a) => [a.date, a.v]),
    [
      ["2026-08-18", 83.9],
      ["2026-08-20", 83.5],
    ],
  );
  assert.deepEqual(
    w.avgPts.map((p) => p.v),
    [83.9, 83.7],
  );
  assert.deepEqual(
    w.projPts.map((p) => p.v),
    [84, 83, 82],
  );
  assert.equal(w.projPts[0].t, t("2026-08-16T12:00:00"));
  const b = chartSeries(log, "bmi", cfg);
  assert.deepEqual(b, {
    isPlan: false,
    unit: "",
    acts: [
      { t: t("2026-08-18"), v: 30.8, date: "2026-08-18" },
      { t: t("2026-08-19"), v: 30.7, date: "2026-08-19" },
      { t: t("2026-08-20"), v: 30.6, date: "2026-08-20" },
    ],
    avgPts: [],
    projPts: [],
  });
  assert.equal(chartSeries(log, "bodyfat", cfg).unit, "%");
  assert.deepEqual(chartSeries([{ date: "2026-09-01", actual: 1 }], "bmi", cfg).acts, []);
  // a reading that isn't a number is plotted (as NaN) but has no 2-wk average
  const odd = chartSeries([{ date: "2026-09-01", actual: "x" }], "weight", cfg);
  assert.equal(odd.acts.length, 1);
  assert.deepEqual(odd.avgPts, []);
  assert.equal(hasEnough({ projPts: [1, 2], acts: [] }), true);
  assert.equal(hasEnough({ projPts: [1], acts: [1, 2] }), true);
  assert.equal(hasEnough({ projPts: [1], acts: [1] }), false);
});

const pts = (...vs) => vs.map((v, i) => ({ t: t("2026-09-01") + i * DAY, v }));

test("layout: compact and expanded sizes, scales and dots", () => {
  const s = { isPlan: false, projPts: [], acts: pts(10, 20), avgPts: [] };
  const c = chartLayout(s, {}, { full: false, box: { w: 0, h: 0 } });
  assert.deepEqual([c.W, c.H, c.k, c.fs, c.sw, c.cW, c.cH], [380, 230, 1, 8, 1.5, 324, 168]);
  assert.deepEqual(c.PAD, { top: 12, right: 16, bottom: 50, left: 40 });
  assert.deepEqual(
    [c.tMin, c.tMax, c.span, c.days, c.dayPx],
    [s.acts[0].t, s.acts[1].t, DAY, 1, 324],
  );
  assert.deepEqual([c.minW, c.maxW], [8.5, 21.5]); // 15% of the range each side
  assert.deepEqual([c.r, c.actSW], [3, 2.0999999999999996]);
  assert.equal(c.xS(s.acts[0].t), 40);
  assert.equal(c.xS(s.acts[1].t), 364);
  assert.equal(c.yS(8.5), 180);
  assert.equal(c.yS(21.5), 12);
  assert.equal(c.full, false);
  // flat values: 1% of the value, at least 0.1
  const flat = (v) => chartLayout({ ...s, acts: pts(v, v) }, {}, { full: false, box: {} });
  assert.deepEqual([flat(50).minW, flat(50).maxW], [49.5, 50.5]);
  assert.deepEqual([flat(-50).minW, flat(-50).maxW], [-50.5, -49.5]);
  assert.deepEqual([flat(2).minW, flat(2).maxW], [1.9, 2.1]);
  // one point in time: span 1 ms, dots at their smallest
  const one = chartLayout(
    {
      ...s,
      acts: [
        { t: 5, v: 1 },
        { t: 5, v: 2 },
      ],
    },
    {},
    { full: false, box: {} },
  );
  assert.deepEqual([one.span, one.days], [1, 1]);
  const wide = chartLayout(
    { ...s, acts: pts(...Array(400).fill(1)) },
    {},
    { full: false, box: {} },
  );
  assert.deepEqual([wide.r, wide.actSW], [0.6, 0.6]);
  const mid = chartLayout({ ...s, acts: pts(...Array(61).fill(1)) }, {}, { full: false, box: {} });
  assert.deepEqual([mid.r, mid.actSW], [2.16, 1.512]); // 5.4 px a day

  // expanded: measured box, at least 12 px a day; window size / defaults without one
  const f = chartLayout(s, {}, { full: true, box: { w: 1000, h: 500 } });
  assert.deepEqual([f.W, f.H, f.k, f.full], [1000, 478, 1.6, true]);
  assert.deepEqual([f.fs, f.sw], [8 * 1.6, 1.5 * 1.6]);
  assert.equal(f.PAD.bottom, 80);
  const many = { ...s, acts: pts(...Array(201).fill(1)) };
  assert.equal(
    chartLayout(many, {}, { full: true, box: { w: 1000, h: 200 } }).W,
    64 + 25.6 + 200 * 12,
  );
  assert.equal(chartLayout(s, {}, { full: true, box: { w: 1000, h: 200 } }).H, 300);
  const def = chartLayout(s, {}, { full: true, box: { w: 0, h: 0 } });
  assert.deepEqual([def.W, def.H], [1200, 578]);
  globalThis.window = { innerWidth: 1048, innerHeight: 750 };
  try {
    const win = chartLayout(s, {}, { full: true, box: { w: 0, h: 0 } });
    assert.deepEqual([win.W, win.H], [1000, 578]);
  } finally {
    delete globalThis.window;
  }
});

test("layout: weight leaves 1 kg and shows the target's bottom", () => {
  const s = { isPlan: true, projPts: pts(84, 80), acts: pts(83), avgPts: [] };
  const L = chartLayout(s, { targetWeightMinKg: 70 }, { full: false, box: {} });
  assert.deepEqual([L.minW, L.maxW], [69, 85]);
  const high = chartLayout(s, { targetWeightMinKg: 82 }, { full: false, box: {} });
  assert.deepEqual([high.minW, high.maxW], [79, 85]);
  const none = chartLayout(s, { targetWeightMinKg: null }, { full: false, box: {} });
  assert.deepEqual([none.minW, none.maxW], [79, 85]);
  const other = chartLayout(
    { ...s, isPlan: false },
    { targetWeightMinKg: 70 },
    { full: false, box: {} },
  );
  assert.equal(other.minW, 79.16); // 1% of 84 beats 15% of 4
  assert.deepEqual(targetZone({ targetWeightMinKg: 70, targetWeightMaxKg: 72 }, true, L), {
    hi: L.yS(72),
    lo: L.yS(70),
  });
  assert.deepEqual(targetZone({ targetWeightMinKg: 70, targetWeightMaxKg: "72" }, true, L), {
    hi: null,
    lo: L.yS(70),
  });
  assert.deepEqual(targetZone({ targetWeightMinKg: 70, targetWeightMaxKg: 72 }, false, L), {
    hi: null,
    lo: null,
  });
});

test("gridlines and date ticks", () => {
  assert.deepEqual(yAxis({ minW: 69, maxW: 85, full: false }), { ticks: [70, 75, 80, 85], dec: 0 });
  assert.deepEqual(yAxis({ minW: 69, maxW: 85, full: true }), {
    ticks: [70, 72, 74, 76, 78, 80, 82, 84],
    dec: 0,
  });
  assert.deepEqual(yAxis({ minW: 0, maxW: 15, full: false }), {
    ticks: [0, 2.5, 5, 7.5, 10, 12.5, 15],
    dec: 1,
  });
  assert.deepEqual(yAxis({ minW: 1, maxW: 2.4, full: false }), {
    ticks: [1, 1.25, 1.5, 1.75, 2, 2.25],
    dec: 2,
  });
  assert.deepEqual(yAxis({ minW: 1.01, maxW: 2.2, full: false }), {
    ticks: [1.2, 1.4, 1.6, 1.8, 2, 2.2],
    dec: 1,
  });
  assert.deepEqual(yAxis({ minW: 0.95, maxW: 1.6, full: false }), {
    ticks: [1, 1.2, 1.4, 1.6], // 1.6 within rounding of the top
    dec: 1,
  });
  const at = t("2026-09-01");
  const ticks = (days, dayPx, fs = 8) =>
    xTicks({ tMin: at - 3600000, tMax: at + days * DAY, dayPx, fs });
  // labels need 2.2 × font size (17.6 px at 8): the finest step that gives them room
  assert.deepEqual(ticks(2, 20), [at, at + DAY, at + 2 * DAY]);
  assert.deepEqual(ticks(4, 9), [at, at + 2 * DAY, at + 4 * DAY]);
  assert.deepEqual(ticks(4, 8.7), [at, at + 3 * DAY]);
  assert.deepEqual(ticks(14, 2.6), [at, at + 7 * DAY, at + 14 * DAY]);
  assert.deepEqual(ticks(60, 1), [at, at + 30 * DAY, at + 60 * DAY]);
  assert.deepEqual(ticks(2, 9, 4), [at, at + DAY, at + 2 * DAY]);
  assert.deepEqual(ticks(800, 0.01), [at, at + 365 * DAY, at + 730 * DAY]); // never wider than a year
  assert.equal(dateLabel(t("2026-09-01T23:30:00Z")), "01/09/2026");
});

test("paths, scrolling, hover areas and the hover label", () => {
  const L = { xS: (x) => x / 3, yS: (v) => v * 2 };
  assert.equal(
    linePath(
      [
        { t: 1, v: 1.25 },
        { t: 3, v: 2 },
      ],
      L,
    ),
    "M0.3,2.5 L1.0,4.0",
  );
  assert.equal(linePath([], L), "");
  assert.equal(latestX({ acts: [{ t: 3 }, { t: 30 }] }, L), 10);
  assert.equal(latestX({ acts: [] }, L), null);
  assert.equal(scrollLeftFor(1000, 400), 700);
  assert.equal(scrollLeftFor(200, 400), 0);
  assert.equal(hitRadius({ r: 1, dayPx: 12 }), 6);
  assert.equal(hitRadius({ r: 1, dayPx: 100 }), 14);
  assert.equal(hitRadius({ r: 4, dayPx: 12 }), 8);

  const at = t("2026-09-01");
  const s = { unit: "kg", avgPts: [{ t: at, v: 83.25 }] };
  assert.equal(hoverLabel({ t: at, v: "83.04" }, s), "01/09/2026 · 83.0 kg · 2-wk avg 83.3");
  assert.equal(hoverLabel({ t: at + DAY, v: 31 }, { unit: "", avgPts: [] }), "02/09/2026 · 31.0");
  const box = { fs: 10, PAD: { left: 40, top: 20 }, cW: 500, xS: (x) => x, yS: (v) => v };
  const label = "x".repeat(10); // 10 × 10 × 0.58 + 16 = 74 wide, 20 high
  assert.deepEqual(hoverBox({ t: 300, v: 100 }, label, box), { bx: 263, by: 68, bw: 74, bh: 20 });
  assert.deepEqual(hoverBox({ t: 300, v: 52 }, label, box), { bx: 263, by: 20, bw: 74, bh: 20 });
  assert.deepEqual(hoverBox({ t: 300, v: 51 }, label, box), { bx: 263, by: 63, bw: 74, bh: 20 });
  assert.deepEqual(hoverBox({ t: 50, v: 100 }, label, box).bx, 40); // kept inside on the left
  assert.deepEqual(hoverBox({ t: 530, v: 100 }, label, box).bx, 466); // … and on the right
});
