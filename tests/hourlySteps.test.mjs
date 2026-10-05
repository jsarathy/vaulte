// tests/hourlySteps.test.mjs — src/lib/hourlySteps.js (Fix 26 PR 39): the step axis, hour values,
// totals and peak, labels, and the chart geometry in the compact and full-screen frames.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  niceAxis,
  hourValues,
  summarise,
  hoverLabel,
  hh,
  fmtDate,
  frameSize,
  geometry,
  HOURS,
} from "../src/lib/hourlySteps.js";

test("niceAxis: 1-2-5 steps, ~target gridlines, ticks 0..yMax", () => {
  assert.deepEqual(niceAxis(1234, 4), { yMax: 1500, ticks: [0, 500, 1000, 1500] });
  assert.deepEqual(niceAxis(1234, 8).ticks, [0, 200, 400, 600, 800, 1000, 1200, 1400]);
  assert.deepEqual(niceAxis(0, 4), { yMax: 1, ticks: [0, 1] }); // no steps: still an axis
  assert.deepEqual(niceAxis(3, 4), { yMax: 3, ticks: [0, 1, 2, 3] }); // never below 1
  assert.deepEqual(niceAxis(10000, 4).ticks, [0, 5000, 10000]);
  assert.deepEqual(niceAxis(21, 4), { yMax: 30, ticks: [0, 10, 20, 30] });
});

test("hourValues: 24 numbers keyed by 2-digit hour; junk and gaps are 0", () => {
  const vals = hourValues({ "00": 5, "07": "1234", 12: "x", 23: 7, 7: 99 });
  assert.equal(vals.length, 24);
  assert.equal(vals[0], 5);
  assert.equal(vals[7], 1234); // "07", not 7
  assert.equal(vals[12], 0);
  assert.equal(vals[23], 7);
  assert.deepEqual(hourValues(null), new Array(24).fill(0));
  assert.deepEqual(hourValues(undefined), new Array(24).fill(0));
});

test("summarise, hh, hoverLabel", () => {
  const vals = hourValues({ "06": 150, "07": 1234, "08": 1234 });
  assert.deepEqual(summarise(vals), { total: 2618, peakVal: 1234, peak: 7 }); // first peak
  assert.deepEqual(summarise(new Array(24).fill(0)), { total: 0, peakVal: 0, peak: 0 });
  assert.equal(hh(7), "07:00");
  assert.equal(hoverLabel(7, vals), "07:00–08:00 · 1,234 steps");
  assert.equal(hoverLabel(23, vals), "23:00–00:00 · 0 steps");
});

test("fmtDate: short weekday/day/month/year, blank for no date", () => {
  assert.match(fmtDate("2026-10-03"), /^Sat,? 3 Oct 2026$/);
  assert.equal(fmtDate(""), "");
  assert.equal(fmtDate(undefined), "");
});

test("frameSize: compact fixed; full from the box with floors, less 4", () => {
  assert.deepEqual(frameSize(false, { w: 900, h: 700 }), { W: 300, H: 130 });
  assert.deepEqual(frameSize(true, { w: 900, h: 700 }), { W: 900, H: 696 });
  assert.deepEqual(frameSize(true, { w: 500, h: 200 }), { W: 600, H: 300 });
  assert.deepEqual(frameSize(true, { w: 0, h: 0 }), { W: 1200, H: 596 }); // unmeasured, no window
});

test("geometry: compact", () => {
  const g = geometry({ full: false, box: { w: 0, h: 0 }, peakVal: 1234 });
  assert.equal(g.k, 1);
  assert.deepEqual(g.PAD, { l: 34, r: 8, t: 10, b: 18 });
  assert.equal(g.cH, 102);
  assert.equal(g.bw, 258 / 24);
  assert.equal(g.fs, 8);
  assert.equal(g.yMax, 1500);
  assert.deepEqual(g.ticks, [0, 500, 1000, 1500]);
  assert.equal(g.yS(0), 112);
  assert.equal(g.yS(1500), 10);
  assert.deepEqual(g.xLabelHours, [0, 3, 6, 9, 12, 15, 18, 21]);
  assert.equal(g.full, false);
});

test("geometry: full screen scales by 1.6, text by 1.5 more, labels every hour", () => {
  const g = geometry({ full: true, box: { w: 1000, h: 704 }, peakVal: 1234 });
  assert.equal(g.k, 1.6);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
  close(g.PAD.l, 34 * 2.4);
  close(g.PAD.r, 8 * 1.6);
  close(g.PAD.t, 10 * 2.4);
  close(g.PAD.b, 18 * 2.4);
  assert.equal(g.W, 1000);
  assert.equal(g.H, 700);
  close(g.cH, 700 - 28 * 2.4);
  close(g.fs, 8 * 2.4);
  assert.deepEqual(g.ticks, [0, 200, 400, 600, 800, 1000, 1200, 1400]);
  assert.deepEqual(g.xLabelHours, HOURS);
  close(g.yS(1400), g.PAD.t);
});
