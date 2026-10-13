// tests/polarHeartRate.test.mjs — a Polar session's heart-rate chart: the line after the axis
// gutter, the y-axis ticks, the max HR and the zones table.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHART,
  ZONES,
  ZONE_INFO,
  axisTicks,
  heartRateChart,
  maxHrOf,
  zoneTable,
} from "../src/lib/polarHeartRate.js";

const bpms = (scale) => axisTicks(scale).map((t) => t.bpm);

test("CHART: the gutter for the axis labels is 40 units", () => {
  assert.deepEqual(CHART, { width: 368, height: 80, pad: 4, left: 40 });
});

test("axisTicks: a tick on each multiple of the smallest step that gives at most five steps", () => {
  assert.deepEqual(bpms({ min: 85, max: 165 }), [100, 120, 140, 160]); // 80 range: steps of 20
  assert.deepEqual(bpms({ min: 95, max: 105 }), [95, 100, 105]); // 10: steps of 5
  assert.deepEqual(bpms({ min: 54.6, max: 105.4 }), [60, 80, 100]);
  // each step's limit: five steps across the scale are allowed, six are not
  assert.deepEqual(bpms({ min: 0, max: 25 }), [0, 5, 10, 15, 20, 25]);
  assert.deepEqual(bpms({ min: 0, max: 26 }), [0, 10, 20]);
  assert.deepEqual(bpms({ min: 0, max: 50 }), [0, 10, 20, 30, 40, 50]);
  assert.deepEqual(bpms({ min: 0, max: 51 }), [0, 20, 40]);
  assert.deepEqual(bpms({ min: 0, max: 100 }), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(bpms({ min: 0, max: 101 }), [0, 25, 50, 75, 100]);
  assert.deepEqual(bpms({ min: 0, max: 125 }), [0, 25, 50, 75, 100, 125]);
  assert.deepEqual(bpms({ min: 0, max: 126 }), [0, 50, 100]);
  assert.deepEqual(bpms({ min: 0, max: 250 }), [0, 50, 100, 150, 200, 250]);
  assert.deepEqual(bpms({ min: 0, max: 400 }), [0, 50, 100, 150, 200, 250, 300, 350, 400]); // none fits: 50
});

test("axisTicks: the ends of the scale are included; the first tick is not below the scale", () => {
  assert.deepEqual(bpms({ min: 90, max: 110 }), [90, 95, 100, 105, 110]);
  assert.deepEqual(bpms({ min: 91, max: 109 }), [95, 100, 105]);
  assert.deepEqual(bpms({ min: 90.5, max: 94.5 }), []);
});

test("axisTicks: y is where the line would be: higher rates nearer the top", () => {
  assert.deepEqual(
    axisTicks({ min: 85, max: 165 }).map((t) => t.y),
    [62.5, 44.5, 26.5, 8.5],
  );
  assert.deepEqual(
    axisTicks({ min: 95, max: 105 }).map((t) => t.y),
    [76, 40, 4],
  );
});

test("maxHrOf: Polar's highest reading for the session, else 180", () => {
  assert.equal(maxHrOf({ hr_max: 150 }), 150);
  assert.equal(maxHrOf({}), 180);
  assert.equal(maxHrOf({ hr_max: 0 }), 180);
  assert.equal(maxHrOf({ hr_max: null }), 180);
});

test("ZONE_INFO: a name and a meaning for each of the five zones", () => {
  assert.equal(ZONE_INFO.length, ZONES.length);
  assert.deepEqual(
    ZONE_INFO.map((z) => z.name),
    ["Easy", "Fat burn", "Aerobic", "Threshold", "Max"],
  );
  assert.deepEqual(
    ZONE_INFO.map((z) => z.meaning),
    [
      "Warm-up and recovery; light effort you could keep up for hours.",
      "Steady endurance; builds your base, with a high share of fat as fuel.",
      "Improves aerobic fitness; moderate effort, you can still talk in short sentences.",
      "Hard; raises speed and stamina, but only for a while.",
      "Very hard, all-out; short bursts only.",
    ],
  );
});

test("zoneTable: each zone from its share of the max, rounded up, to just before the next", () => {
  const ranges = (max) => zoneTable(max).map((z) => z.range);
  assert.deepEqual(ranges(160), ["under 96", "96–111", "112–127", "128–143", "144+"]);
  assert.deepEqual(ranges(180), ["under 108", "108–125", "126–143", "144–161", "162+"]);
  assert.deepEqual(ranges(185), ["under 111", "111–129", "130–147", "148–166", "167+"]);
  assert.deepEqual(ranges(100), ["under 60", "60–69", "70–79", "80–89", "90+"]);
  assert.deepEqual(ranges(123), ["under 74", "74–86", "87–98", "99–110", "111+"]); // 73.8, 86.1, 98.4, 110.7
});

test("zoneTable: rows carry the label, name, colour and meaning of the zone", () => {
  const rows = zoneTable(160);
  assert.deepEqual(
    rows.map((z) => [z.label, z.name, z.color]),
    [
      ["Z1", "Easy", "#B5D4F4"],
      ["Z2", "Fat burn", "#C0DD97"],
      ["Z3", "Aerobic", "#FAC775"],
      ["Z4", "Threshold", "#F0997B"],
      ["Z5", "Max", "#E24B4A"],
    ],
  );
  assert.deepEqual(
    rows.map((z) => z.meaning),
    ZONE_INFO.map((z) => z.meaning),
  );
});

test("zoneTable: every whole bpm is in the zone that the chart's time-in-zone counts it in", () => {
  const within = (range, v) => {
    const under = /^under (\d+)$/.exec(range);
    if (under) return v < Number(under[1]);
    const plus = /^(\d+)\+$/.exec(range);
    if (plus) return v >= Number(plus[1]);
    const [lo, hi] = range.split("–").map(Number);
    return v >= lo && v <= hi;
  };
  for (const max of [100, 110, 120, 123, 150, 160, 170, 175, 180, 185, 190, 200, 210, 220]) {
    const rows = zoneTable(max);
    for (let v = 30; v <= 240; v++) {
      const expected = [0.6, 0.7, 0.8, 0.9].filter((limit) => v / max >= limit).length;
      const found = rows.map((r, i) => (within(r.range, v) ? i : -1)).filter((i) => i >= 0);
      assert.deepEqual(found, [expected], `${v} bpm of max ${max}`);
    }
  }
});

test("heartRateChart: the line starts after the axis gutter and ends at the right edge; ticks and max HR come with it", () => {
  const c = heartRateChart({ hr_samples: [100, 120] });
  assert.equal(c.points, "40.0,64.0 364.0,16.0");
  assert.equal(c.maxHr, 180);
  assert.deepEqual(
    c.ticks.map((t) => t.bpm),
    [100, 110, 120],
  ); // scale 95–125: steps of 10
  assert.equal(c.avgY, null);
  assert.equal(heartRateChart({ hr_samples: [100, 120], hr_max: 150 }).maxHr, 150);
  assert.equal(heartRateChart({ hr_samples: [100, 120], hr_avg: 110 }).avgY, 40);
  const eleven = heartRateChart({
    hr_samples: [90, 100, 110, 130, 140, 150, null, 155, 160, 100, 95],
  });
  assert.equal(eleven.points.split(" ")[1], "72.4,62.5"); // 40 + 1 × 324 / 10
});
