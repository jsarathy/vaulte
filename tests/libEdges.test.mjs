// tests/libEdges.test.mjs — edge cases in src/lib that the first mutation runs showed no test
// guarded (Fix 79): a missing field, a boundary, an exact text. One section per module.
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { chatMealName, mealNotFound } from "../src/lib/chatLog.js";
import { fmtDate, frameSize, niceAxis, todayISO } from "../src/lib/hourlySteps.js";
import { loggedPlace } from "../src/lib/polarLog.js";
import { compareStart, datedRows, mergeDays, mergeRows } from "../src/lib/trackerStart.js";
import { withWeightRow } from "../src/lib/weightEntry.js";
import { findSavedRecipe } from "../src/lib/addFood.js";
import { mealsForDate } from "../src/lib/chatMessages.js";

// ---- chatLog.js
test("chatLog: the 'meal not found' text names the date", () => {
  assert.equal(
    mealNotFound("2026-10-04"),
    "Couldn't find that meal on 2026-10-04 — nothing was logged.",
  );
});

test("chatLog: chatMealName copes with no meal chosen and a day without meals", () => {
  const base = { allDays: [], chatDate: "2026-10-04", currentDayData: null };
  assert.equal(chatMealName({ ...base, chatMealId: undefined }), "Meal");
  assert.equal(chatMealName({ ...base, chatMealId: null }), "Meal");
  assert.equal(chatMealName({ ...base, currentDayData: {}, chatMealId: "m1" }), "Meal");
  assert.equal(
    chatMealName({ ...base, allDays: [{ date: "2026-10-04" }], chatMealId: "m1" }),
    "Meal",
  );
  assert.equal(chatMealName({ ...base, chatMealId: "__slot__Lunch" }), "Lunch");
});

// ---- hourlySteps.js
test("hourlySteps: niceAxis keeps a step that fits exactly (100 over 5 lines is 20, not 50)", () => {
  assert.deepEqual(niceAxis(100, 5), { yMax: 100, ticks: [0, 20, 40, 60, 80, 100] });
  assert.deepEqual(niceAxis(10, 5), { yMax: 10, ticks: [0, 2, 4, 6, 8, 10] });
});

test("hourlySteps: fmtDate is weekday, day, month and year in British order; blank for no date", () => {
  assert.match(fmtDate("2026-10-04"), /^Sun,? 4 Oct 2026$/);
  assert.equal(fmtDate(""), "");
  assert.equal(fmtDate(null), "");
});

test("hourlySteps: fmtDate shows the same day in a time zone behind UTC", () => {
  const script =
    'import { fmtDate } from "./src/lib/hourlySteps.js"; console.log(fmtDate("2026-10-04"));';
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: { ...process.env, TZ: "America/Los_Angeles" },
  });
  assert.match(out.trim(), /^Sun,? 4 Oct 2026$/);
});

test("hourlySteps: todayISO is today's local date as YYYY-MM-DD", () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  assert.equal(todayISO(), `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
});

test("hourlySteps: the full-screen frame is the measured box, else the window less its margins", () => {
  assert.deepEqual(frameSize(false, { w: 1000, h: 800 }), { W: 300, H: 130 });
  assert.deepEqual(frameSize(true, { w: 1000, h: 800 }), { W: 1000, H: 796 });
  assert.deepEqual(frameSize(true, { w: 400, h: 200 }), { W: 600, H: 300 }); // at least 600 x 300
  assert.deepEqual(frameSize(true, {}), { W: 1200, H: 596 }); // no window, no box: the fallback
  globalThis.window = { innerWidth: 1000, innerHeight: 800 };
  try {
    assert.deepEqual(frameSize(true, {}), { W: 952, H: 656 }); // 1000 - 48 and 800 - 140 - 4
    assert.deepEqual(frameSize(true, { w: 700 }), { W: 700, H: 656 });
  } finally {
    delete globalThis.window;
  }
});

// ---- polarLog.js
test("polarLog: a session without an id is not found in a meal that has no items", () => {
  const days = [{ date: "2026-10-04", meals: [{ name: "Lunch" }] }];
  assert.equal(loggedPlace(days, {}), null);
  assert.equal(loggedPlace([{ date: "2026-10-04" }], { id: "p1" }), null);
});

// ---- trackerStart.js
test("trackerStart: datedRows puts the rows in date order", () => {
  const doc = (id, data = {}) => ({ id, data: () => data });
  assert.deepEqual(
    datedRows([doc("2026-10-03"), doc("2026-10-01", { w: 1 }), doc("2026-10-02")]).map(
      (r) => r.date,
    ),
    ["2026-10-01", "2026-10-02", "2026-10-03"],
  );
});

test("trackerStart: mergeRows keeps a row with no date first, the rest oldest first", () => {
  const out = mergeRows(
    [{ date: "2026-10-02" }, { date: "2026-10-04" }],
    [{ x: 1 }, { date: "2026-10-03" }],
  );
  assert.deepEqual(
    out.map((r) => r.date),
    [undefined, "2026-10-02", "2026-10-03", "2026-10-04"],
  );
});

test("trackerStart: mergeRows sorts rows with no date wherever they start", () => {
  const dated = [{ date: "2026-10-03" }, { date: "2026-10-01" }, { date: "2026-10-02" }];
  for (const stored of [[{ x: 1 }], [{ x: 1 }, { x: 2 }]]) {
    for (const shown of [dated, [...dated].reverse()]) {
      const out = mergeRows(shown, stored);
      assert.deepEqual(
        out.map((r) => r.date),
        [...stored.map(() => undefined), "2026-10-01", "2026-10-02", "2026-10-03"],
      );
      const flipped = mergeRows(stored, shown);
      assert.deepEqual(
        flipped.map((r) => r.date),
        out.map((r) => r.date),
      );
    }
  }
});

test("trackerStart: mergeDays adds the days read later and returns them newest first", () => {
  const shown = [{ date: "2026-10-02" }];
  const stored = [{ date: "2026-10-03" }, { date: "2026-10-04" }, { date: "2026-10-02" }];
  assert.deepEqual(
    mergeDays(shown, stored).map((d) => d.date),
    ["2026-10-04", "2026-10-03", "2026-10-02"],
  );
  assert.equal(mergeDays(shown, [{ date: "2026-10-02" }]), shown); // nothing new: the same list back
});

test("trackerStart: compareStart takes days that have any entry; a meal without items is fine", () => {
  const days = [
    { date: "d1", meals: [{ name: "Breakfast" }, { name: "Lunch", items: [{ id: 1 }] }] },
    { date: "d2", meals: [{ name: "Breakfast", items: [] }] },
    { date: "d3" },
    { date: "d4", meals: [{ items: [{ id: 2 }] }, { items: [] }] },
  ];
  const out = compareStart(days);
  assert.deepEqual(out.slots, ["d1", "d4", null, null, null]);
  assert.deepEqual(
    out.data.map((d) => d && d.date),
    ["d1", "d4", null, null, null],
  );
});

// ---- weightEntry.js
test("weightEntry: withWeightRow keeps a log row with no date ahead of the dated ones", () => {
  const log = [{ date: "2026-10-02", actual: 90 }, { actual: 1 }];
  const out = withWeightRow(log, { date: "2026-10-01", actual: 91 });
  assert.deepEqual(
    out.map((r) => r.date),
    [undefined, "2026-10-01", "2026-10-02"],
  );
  assert.deepEqual(
    withWeightRow(out, { date: "2026-10-02", actual: 89 }).map((r) => r.actual),
    [1, 91, 89],
  );
});

// ---- addFood.js
test("addFood: a saved recipe counts as having macros if any one of the four is above zero", () => {
  const recipe = (nutrition) => ({ name: "Stew", nutrition });
  for (const k of ["kcal", "protein", "fat", "carbs"]) {
    const r = recipe({ [k]: 5 });
    assert.equal(findSavedRecipe([r], "stew"), r, k);
  }
  assert.equal(findSavedRecipe([recipe({ kcal: 0, fat: 0 })], "stew"), null);
  assert.equal(findSavedRecipe([recipe({ sugar: 9 })], "stew"), null);
  assert.equal(findSavedRecipe([{ name: "Stew" }], "stew"), null);
});

// ---- chatMessages.js
test("chatMessages: a stored day with no meals offers the default slots by name", () => {
  const meals = mealsForDate([{ date: "2026-10-04" }], "2026-10-04", null);
  assert.ok(meals.length >= 3);
  for (const m of meals) assert.equal(m.id, "__slot__" + m.name);
});
