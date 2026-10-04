// tests/trackerDays.test.mjs — saved days, Compare slots, sidebar stats, weight / Polar sync
// helpers (Fix 26 PR 19)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasEntries,
  withSavedDay,
  withoutItem,
  compareAfterSave,
  streakDays,
  sevenDayAverage,
} from "../src/lib/trackerDays.js";
import {
  renphoRows,
  withRows,
  renphoSyncedText,
  rowsBefore,
  withoutRowsBefore,
  withBodyRow,
  withSyncedSessions,
  polarSyncedText,
} from "../src/lib/weightSync.js";

const day = (date, kcal) => ({
  date,
  meals: [{ id: "m", items: kcal == null ? [] : [{ id: "i", kcal }] }],
});
const empty = (date) => day(date, null);

test("entries and saving", () => {
  assert.equal(hasEntries(day("a", 1)), true);
  assert.equal(hasEntries(empty("a")), false);
  assert.equal(hasEntries({ date: "a" }), false);
  assert.equal(hasEntries(null), false);
  const days = [day("2026-10-01", 1), day("2026-10-04", 2)];
  const saved = day("2026-10-01", 9);
  assert.deepEqual(withSavedDay(days, saved), [days[1], saved]);
  assert.deepEqual(
    withSavedDay(days, day("2026-10-09", 1)).map((d) => d.date),
    ["2026-10-09", "2026-10-04", "2026-10-01"],
  );
  const d = {
    date: "x",
    meals: [
      { id: "a", items: [{ id: 1 }, { id: 2 }] },
      { id: "b", items: [{ id: 1 }] },
    ],
  };
  assert.deepEqual(withoutItem(d, "a", 1).meals, [
    { id: "a", items: [{ id: 2 }] },
    { id: "b", items: [{ id: 1 }] },
  ]);
  assert.equal(d.meals[0].items.length, 2); // not mutated
});

test("Compare after a save", () => {
  const a = day("2026-10-01", 1);
  const b = day("2026-10-04", 1);
  const compare = {
    slots: ["2026-10-01", "2026-10-04", null, null, null],
    data: [a, b, null, null, null],
  };
  const newer = day("2026-10-09", 1);
  assert.deepEqual(compareAfterSave(compare, newer, []), {
    slots: ["2026-10-09", "2026-10-01", "2026-10-04", null, null],
    data: [newer, a, b, null, null],
  });
  assert.equal(compareAfterSave(compare, day("2026-10-02", 1), []), null); // older than a slot
  assert.equal(compareAfterSave(compare, day("2026-10-04", 5), []), null); // already shown
  const full = { slots: ["5", "4", "3", "2", "1"], data: ["e", "d", "c", "b", "a"] };
  assert.deepEqual(compareAfterSave(full, day("6", 1), []).slots, ["6", "5", "4", "3", "2"]);
  assert.equal(compareAfterSave(full, day("6", 1), []).data.length, 5);
  // emptied: leaves; the first other logged day not shown fills in
  const days = [a, b, empty("2026-10-05"), day("2026-10-06", 1), day("2026-10-07", 1)];
  assert.deepEqual(compareAfterSave(compare, empty("2026-10-01"), days), {
    slots: ["2026-10-04", null, null, null, "2026-10-06"],
    data: [b, null, null, null, days[3]],
  });
  assert.deepEqual(compareAfterSave(compare, empty("2026-10-04"), [a, b]), {
    slots: ["2026-10-01", null, null, null, null],
    data: [a, null, null, null, null],
  });
  assert.equal(compareAfterSave(compare, empty("2026-10-09"), days), null); // not shown
});

test("streak and 7-day average", () => {
  const today = new Date("2026-10-04T10:00:00Z");
  const dates = ["2026-10-04", "2026-10-03", "2026-10-02", "2026-09-30"];
  assert.equal(
    streakDays(
      dates.map((d) => day(d, 1)),
      today,
    ),
    3,
  );
  assert.equal(streakDays([day("2026-10-03", 1)], today), 0);
  const many = Array.from({ length: 40 }, (_, i) =>
    day(new Date(Date.UTC(2026, 9, 4 - i)).toISOString().split("T")[0], 1),
  );
  assert.equal(streakDays(many, today), 30);
  assert.equal(sevenDayAverage([day("a", 52), empty("b"), empty("c"), day("d", -250)]), "-49 kcal");
  const eight = [...Array(7).fill(day("x", 1000)), day("y", 99999)];
  assert.equal(sevenDayAverage(eight), "1,000 kcal");
  assert.equal(sevenDayAverage([empty("a")]), "—");
});

test("Renpho rows, log merge, messages, purge, body rows", () => {
  const log = [{ date: "2026-10-01", week: 7, dose: "5mg", actual: 84, renpho: { old: 1 } }];
  const rows = renphoRows(log, [
    { date: "2026-10-01", weight: 83.6, metrics: { fat: 30 } },
    { date: "2026-10-03", weight: 83.2 },
  ]);
  assert.deepEqual(rows, [
    { date: "2026-10-01", week: 7, dose: "5mg", actual: 83.6, renpho: { fat: 30 } },
    { date: "2026-10-03", actual: 83.2 },
  ]);
  assert.deepEqual(renphoRows(log, [{ date: "2026-10-01", weight: 1 }])[0].renpho, { old: 1 });
  assert.deepEqual(
    withRows(
      [{ date: "2026-10-05" }, { date: "2026-10-01", x: 1 }],
      [{ date: "2026-10-01", x: 2 }, {}],
    ),
    [{}, { date: "2026-10-01", x: 2 }, { date: "2026-10-05" }],
  );
  assert.equal(renphoSyncedText({}, 1), "Synced 1 measurement.");
  assert.equal(
    renphoSyncedText({ rejected: 2, fromDate: "2026-09-01" }, 3),
    "Synced 3 measurements (2 before 2026-09-01 ignored).",
  );
  const w = [{ date: "2026-08-20" }, { date: "2026-09-01" }, { x: 1 }, { date: "2026-10-01" }];
  assert.deepEqual(rowsBefore(w, "2026-09-01"), [{ date: "2026-08-20" }]);
  assert.deepEqual(withoutRowsBefore(w, "2026-09-01"), w.slice(1));
  assert.deepEqual(withBodyRow([{ date: "b" }, {}], { date: "a" }), [
    {},
    { date: "a" },
    { date: "b" },
  ]);
});

test("Polar sync merge and message", () => {
  const prev = [{ id: "a", start_time: "2026-10-01", calories: 1 }];
  const out = withSyncedSessions(prev, [
    { id: "a", start_time: "2026-10-01", calories: 9 },
    { id: "b", start_time: "2026-10-03" },
    { id: "c", start_time: "2026-10-04", logged: true },
    { id: "d" },
  ]);
  assert.deepEqual(
    out.map((s) => [s.id, s.calories]),
    [
      ["b", undefined],
      ["a", 1],
      ["d", undefined],
    ],
  );
  assert.equal(polarSyncedText(1), "Synced 1 session.");
  assert.equal(polarSyncedText(3), "Synced 3 sessions.");
});
