// tests/polarLog.test.mjs — the "log a Polar session" box's figures (Fix 26 PR 17)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sportName,
  sessionWhen,
  sessionDate,
  fatBurned,
  durationMin,
  sessionStats,
  polarExerciseItem,
  loggedPlace,
} from "../src/lib/polarLog.js";
import { CHART, ZONES, heartRateChart } from "../src/lib/polarHeartRate.js";

const RIDE = {
  id: "p1",
  sport: "INDOOR_CYCLING",
  start_time: "2026-10-03T08:00:00",
  duration_min: 45.6,
  calories: 400,
  hr_avg: 130,
  hr_max: 160,
  fat_pct: 40,
};

test("sport name: each word's first letter capitalised, else Exercise", () => {
  assert.equal(sportName("INDOOR_CYCLING"), "Indoor Cycling");
  assert.equal(sportName("road_running"), "Road Running");
  assert.equal(sportName("Golf"), "Golf");
  assert.equal(sportName(undefined), "Exercise");
  assert.equal(sportName(""), "Exercise");
});

test("when: from start time, else the stored date", () => {
  const w = sessionWhen(RIDE);
  assert.match(w.dateText, /^Saturday,? 3 October$/);
  assert.equal(w.timeText, "08:00");
  assert.deepEqual(sessionWhen({ date: "2026-10-09" }), { dateText: "2026-10-09", timeText: "" });
  assert.deepEqual(sessionWhen({}), { dateText: "", timeText: "" });
});

test("session date: start date, stored date, else today (UTC)", () => {
  const now = new Date("2026-10-04T23:30:00Z");
  assert.equal(sessionDate(RIDE, now), "2026-10-03");
  assert.equal(sessionDate({ date: "2026-10-09" }, now), "2026-10-09");
  assert.equal(sessionDate({}, now), "2026-10-04");
});

test("fat burned, duration, stats", () => {
  assert.deepEqual(fatBurned(RIDE), { g: 18, kcal: 160 });
  assert.deepEqual(fatBurned({ calories: 333, fat_pct: 50 }), { g: 19, kcal: 167 });
  assert.deepEqual(fatBurned({ calories: 100, fat_pct: 0 }), { g: 0, kcal: 0 });
  assert.deepEqual(fatBurned({ calories: 100 }), { g: 0, kcal: 0 });
  assert.equal(durationMin(RIDE), 46);
  assert.equal(durationMin({}), 0);
  assert.deepEqual(sessionStats(RIDE), [
    ["Duration", "46 min"],
    ["Calories", "400 kcal"],
    ["Avg HR", "130 bpm"],
    ["Max HR", "160 bpm"],
    ["Fat burn", "40%"],
    ["Fat burned", "18g"],
  ]);
  assert.deepEqual(sessionStats({ calories: 150 }), [
    ["Duration", "0 min"],
    ["Calories", "150 kcal"],
  ]);
  assert.deepEqual(sessionStats({ calories: 9, fat_pct: 0 }).slice(2), [
    ["Fat burn", "0%"],
    ["Fat burned", "0g"],
  ]);
});

test("logged exercise entry", () => {
  assert.deepEqual(polarExerciseItem(RIDE, "i"), {
    id: "i",
    name: "Indoor Cycling (46 min) · Polar",
    kcal: -400,
    fat: 0,
    sat_fat: 0,
    carbs: 0,
    sugar: 0,
    fibre: 0,
    net_carbs: 0,
    protein: 0,
    is_exercise: 1,
    fat_burned_g: 18,
    fat_burned_kcal: 160,
    polar_session_id: "p1",
  });
  assert.equal(polarExerciseItem({ calories: 5 }, "j").name, "Exercise (0 min) · Polar");
});

test("heart-rate chart: scale, points, average, zones", () => {
  assert.deepEqual(CHART, { width: 368, height: 80, pad: 4 });
  assert.equal(heartRateChart({}), null);
  assert.equal(heartRateChart({ hr_samples: [100] }), null);
  const c = heartRateChart({
    hr_samples: [90, 100, 110, 130, 140, 150, null, 155, 160, 100, 95],
    hr_avg: 130,
    hr_max: 160,
    recording_rate_s: 30,
  });
  assert.deepEqual([c.low, c.high, c.min, c.max, c.minutes], [90, 160, 85, 165, 5]);
  const pts = c.points.split(" ");
  assert.equal(pts.length, 10);
  assert.deepEqual(
    [pts[0], pts[5], pts[6], pts[9]],
    ["4.0,71.5", "184.0,17.5", "256.0,13.0", "364.0,67.0"],
  );
  assert.equal(c.avgY, 35.5);
  assert.deepEqual(
    c.zones.map((z) => [z.label, z.color, z.secs]),
    ZONES.map((z, i) => [z.label, z.color, [60, 90, 0, 60, 90][i]]),
  );
  assert.equal(c.totalSecs, 300);
  // boundaries: exactly 60/70/80/90 % go up a zone
  const b = heartRateChart({
    hr_samples: [59, 60, 70, 80, 90, 100],
    hr_max: 100,
    recording_rate_s: 1,
  });
  assert.deepEqual(
    b.zones.map((z) => z.secs),
    [1, 1, 1, 1, 2],
  );
  // defaults: 5 s samples, max HR 180, no average; ≤ ~200 points
  const d = heartRateChart({ hr_samples: Array(450).fill(100) });
  assert.equal(d.minutes, 37);
  assert.equal(d.avgY, null);
  assert.equal(d.points.split(" ").length, 225);
  assert.deepEqual(
    d.zones.map((z) => z.secs),
    [2250, 0, 0, 0, 0],
  );
  assert.equal(heartRateChart({ hr_samples: Array(399).fill(100) }).points.split(" ").length, 399);
  assert.equal(heartRateChart({ hr_samples: [null, null, 120, 120] }).totalSecs, 10);
  assert.deepEqual(
    ZONES.map((z) => z.color),
    ["#B5D4F4", "#C0DD97", "#FAC775", "#F0997B", "#E24B4A"],
  );
});

test("loggedPlace: the day and meal a session went to; null when not stored", () => {
  const days = [
    { date: "2026-10-02", meals: [{ name: "Lunch", items: [{ id: "a" }] }] },
    {
      date: "2026-10-03",
      meals: [
        { name: "Breakfast", items: [] },
        { name: "Exercise", items: [{ polar_session_id: "p1" }] },
      ],
    },
    { date: "2026-10-04" },
  ];
  assert.deepEqual(loggedPlace(days, { id: "p1" }), { date: "2026-10-03", meal: "Exercise" });
  assert.equal(loggedPlace(days, { id: "zz" }), null);
  assert.equal(loggedPlace([], { id: "p1" }), null);
});
