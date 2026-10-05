// tests/polarDetail.test.mjs — the Daily log's Polar session box and its heart-rate chart
// (Fix 26 PR 27). The box on screen is pinned by tests/ui/polar-detail.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sportTitle,
  startedAt,
  sessionStats,
  hasHeartRate,
  canFetchHeartRate,
  fetchError,
} from "../src/lib/polarDetail.js";
import { hrChart, HR_ZONES } from "../src/lib/hrChart.js";

test("title, start and stats", () => {
  assert.equal(sportTitle("INDOOR_CYCLING"), "Indoor Cycling");
  assert.equal(sportTitle("strength_training_2"), "Strength Training 2");
  assert.equal(sportTitle(""), "Exercise");
  assert.equal(sportTitle(undefined), "Exercise");
  const tz = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    // (Node and browsers differ on the comma after the weekday)
    assert.match(startedAt("2026-10-04T07:05:00"), /^Sunday,? 4 October 2026 · 07:05$/);
    assert.match(startedAt("2026-10-04T07:05:00Z"), /^Sunday,? 4 October 2026 · 08:05$/);
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
  assert.equal(startedAt(""), "");
  assert.equal(startedAt(undefined), "");
  const full = {
    duration_min: 45.5,
    calories: 400,
    hr_avg: 131,
    hr_max: 168,
    fat_pct: 35,
    device: "Polar H10",
  };
  assert.deepEqual(sessionStats(full), [
    ["Duration", "46 min"],
    ["Calories", "400 kcal"],
    ["Avg HR", "131 bpm"],
    ["Max HR", "168 bpm"],
    ["Fat burn %", "35%"],
    ["Fat burned", "16g · 140 kcal"],
    ["Device", "Polar H10"],
  ]);
  assert.deepEqual(sessionStats({ calories: 0, fat_pct: 0 }), [
    ["Duration", "0 min"],
    ["Calories", "0 kcal"],
    ["Fat burn %", "0%"],
    ["Fat burned", "0g · 0 kcal"],
  ]);
  assert.deepEqual(sessionStats({ calories: 5, hr_avg: 0, hr_max: 0, fat_pct: null }), [
    ["Duration", "0 min"],
    ["Calories", "5 kcal"],
  ]);
});

test("heart rate: shown, fetchable, errors", () => {
  assert.equal(hasHeartRate({ hr_samples: [1, 2] }), true);
  assert.equal(hasHeartRate({ hr_samples: [1] }), false);
  assert.equal(hasHeartRate({}), false);
  assert.equal(canFetchHeartRate({ exercise_url: "u" }), true);
  assert.equal(canFetchHeartRate({ polar_user_id: 3 }), true);
  assert.equal(canFetchHeartRate({ exercise_url: "" }), false);
  assert.equal(fetchError({ message: "m", error: "e" }), "m");
  assert.equal(fetchError({ error: "e" }), "e");
  assert.equal(fetchError({}), "Failed to fetch HR data.");
});

test("chart: scale, line, average and zones", () => {
  assert.equal(hrChart(null), null);
  assert.equal(hrChart({}), null);
  assert.equal(hrChart({ hr_samples: [100] }), null);
  assert.equal(hrChart({ hr_samples: [100, null, null] }), null);
  const c = hrChart({ hr_samples: [100, null, 150, 200], hr_max: 200, hr_avg: 150 });
  assert.deepEqual([c.low, c.high, c.scale], [100, 200, { min: 95, max: 205 }]);
  assert.equal(c.minutes, 0); // 4 × 5 s
  // x across 4 slots, y from the top (205) to the bottom (95); the gap is skipped
  assert.equal(c.points, "4.0,82.3 278.7,45.0 416.0,7.7");
  assert.equal(c.avgY, 45);
  assert.deepEqual(
    c.zones.map((z) => z.secs),
    [5, 0, 5, 0, 0].map((x, i) => (i === 4 ? 5 : x)),
  );
  assert.deepEqual(
    c.zones.map((z) => [z.label, z.color]),
    [
      ["Z1 Easy", "#B5D4F4"],
      ["Z2 Fat burn", "#C0DD97"],
      ["Z3 Aerobic", "#FAC775"],
      ["Z4 Threshold", "#F0997B"],
      ["Z5 Max", "#E24B4A"],
    ],
  );
  assert.equal(HR_ZONES.length, 5);
  assert.equal(c.totalSecs, 15);
  // zone edges at 60 / 70 / 80 / 90% of max; default max 185, default rate 5
  const edges = hrChart({
    hr_samples: [119, 120, 140, 160, 180],
    hr_max: 200,
    recording_rate_s: 2,
  });
  assert.deepEqual(
    edges.zones.map((z) => z.secs),
    [2, 2, 2, 2, 2],
  );
  const dflt = hrChart({ hr_samples: [110, 185] });
  assert.deepEqual(
    dflt.zones.map((z) => z.secs),
    [5, 0, 0, 0, 5],
  );
  assert.equal(dflt.avgY, null);
  assert.equal(hrChart({ hr_samples: Array(24).fill(120), recording_rate_s: 5 }).minutes, 2);
  // gaps count towards the time recorded, but not towards any zone; a 0 reading is a reading
  const gappy = hrChart({ hr_samples: [...Array(12).fill(120), ...Array(12).fill(null)] });
  assert.equal(gappy.minutes, 2);
  assert.equal(gappy.totalSecs, 60);
  assert.deepEqual(hrChart({ hr_samples: [0, 120] }).zones[0].secs, 5);
  assert.equal(hrChart({ hr_samples: [120, 120] }).totalSecs, 10);
  // long sessions: every n-th sample, ~300 points
  const long = hrChart({ hr_samples: Array.from({ length: 900 }, (_, i) => 100 + (i % 50)) });
  assert.equal(long.points.split(" ").length, 300);
  const short = hrChart({ hr_samples: Array.from({ length: 599 }, (_, i) => 100 + (i % 50)) });
  assert.equal(short.points.split(" ").length, 599);
});
