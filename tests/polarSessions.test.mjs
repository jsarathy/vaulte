// tests/polarSessions.test.mjs — Polar session labels, dates and filters (Fix 26 PR 10)
// Dates are built from local times (no zone), so they read the same in any time zone.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sportName,
  fatBurnedGrams,
  syncTimeText,
  pendingWhen,
  recentWhen,
  browseWhen,
  pendingCountText,
  recentLogged,
  matchesSearch,
  browseCountsText,
  browseStats,
} from "../src/lib/polarSessions.js";

const S = {
  id: "a",
  sport: "INDOOR_CYCLING",
  start_time: "2026-10-03T08:00:00",
  duration_min: 45.6,
  calories: 400,
  hr_avg: 130,
  hr_max: 160,
  fat_pct: 40,
  hr_samples: [1],
  logged: true,
};
const BARE = { id: "b", calories: 150, date: "2026-09-30" };

test("sport name and fat burned", () => {
  assert.equal(sportName(S), "Indoor Cycling");
  assert.equal(sportName({ sport: "running" }), "Running");
  assert.equal(sportName(BARE), "Exercise");
  assert.equal(fatBurnedGrams(S), 18); // 400 × 40% ÷ 9 = 17.8
  assert.equal(fatBurnedGrams({ calories: 100, fat_pct: 0 }), 0);
  assert.equal(fatBurnedGrams(BARE), null);
});

test("dates and times", () => {
  assert.equal(syncTimeText("2026-10-04T09:05:00"), "4 Oct, 09:05");
  assert.match(pendingWhen(S), /^Sat,? 3 Oct 08:00$/); // ICU versions differ on the comma
  assert.equal(pendingWhen(BARE), " ");
  assert.equal(recentWhen(S), "3 Oct");
  assert.equal(recentWhen(BARE), "");
  assert.match(browseWhen(S), /^Sat,? 3 Oct 2026 · 08:00$/);
  assert.equal(browseWhen(BARE), "2026-09-30");
  assert.equal(browseWhen({}), "");
});

test("counts", () => {
  assert.equal(pendingCountText(1), "1 unlogged session");
  assert.equal(pendingCountText(2), "2 unlogged sessions");
  assert.equal(browseCountsText([S, BARE, { logged: true }]), "3 total · 2 logged · 1 pending");
  assert.equal(browseCountsText([]), "0 total · 0 logged · 0 pending");
});

test("recent: null before loading, logged only, at most 10", () => {
  assert.equal(recentLogged([]), null);
  assert.deepEqual(recentLogged([BARE]), []);
  const many = Array.from({ length: 12 }, (_, i) => ({ id: i, logged: true }));
  assert.deepEqual(
    recentLogged([BARE, ...many]).map((s) => s.id),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("search: activity, date text, ISO date; case-insensitive; blank matches all", () => {
  assert.equal(matchesSearch(S, ""), true);
  assert.equal(matchesSearch(S, "Indoor Cyc"), true);
  assert.equal(matchesSearch(S, "3 OCT 2026"), true);
  assert.equal(matchesSearch(S, "2026-10-03"), true);
  assert.equal(matchesSearch(S, "run"), false);
  assert.equal(matchesSearch(BARE, "exercise"), false);
  assert.equal(matchesSearch(BARE, "2026"), false);
});

test("browse figures", () => {
  assert.deepEqual(browseStats(S), [
    ["Duration", "46 min"],
    ["Calories", "400 kcal"],
    ["Avg HR", "130 bpm"],
    ["Max HR", "160 bpm"],
    ["Fat burned", "18g"],
    ["HR data", "✓"],
  ]);
  assert.deepEqual(browseStats({ ...BARE, fat_pct: 0 }).at(-1), ["Fat burned", "0g"]);
  assert.deepEqual(browseStats(BARE), [
    ["Duration", "0 min"],
    ["Calories", "150 kcal"],
  ]);
});
