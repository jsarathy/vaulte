// tests/calendarWeight.test.mjs — sidebar calendar month and the weight entry box (Fix 26 PR 16)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WEEKDAYS,
  isoDate,
  prevMonth,
  nextMonth,
  monthLabel,
  leadingBlanks,
  monthDays,
} from "../src/lib/calendarMonth.js";
import {
  entryFor,
  numberOrNull,
  weightRow,
  withWeightRow,
  withoutWeightRow,
} from "../src/lib/weightEntry.js";

const OCT = { year: 2026, month: 9 };
const food = (date, kcal) => ({ date, notes: "", meals: [{ id: "m", items: [{ kcal }] }] });

test("month paging, label, blanks, dates", () => {
  assert.deepEqual(WEEKDAYS, ["M", "T", "W", "T", "F", "S", "S"]);
  assert.equal(isoDate(2026, 0, 5), "2026-01-05");
  assert.equal(isoDate(2026, 11, 25), "2026-12-25");
  assert.deepEqual(prevMonth(OCT), { year: 2026, month: 8 });
  assert.deepEqual(prevMonth({ year: 2026, month: 0 }), { year: 2025, month: 11 });
  assert.deepEqual(nextMonth(OCT), { year: 2026, month: 10 });
  assert.deepEqual(nextMonth({ year: 2026, month: 11 }), { year: 2027, month: 0 });
  assert.match(monthLabel(OCT), /October.*2026/);
  assert.equal(leadingBlanks(OCT), 3); // Thursday
  assert.equal(leadingBlanks({ year: 2026, month: 5 }), 0); // 1 June 2026 is a Monday
  assert.equal(leadingBlanks({ year: 2026, month: 1 }), 6); // 1 Feb 2026 is a Sunday
});

test("month days: dates, kcal, logged / open / today", () => {
  const days = [food("2026-10-01", 52.4), { date: "2026-10-02", notes: "", meals: [] }];
  const d = monthDays(OCT, days, { currentDate: "2026-10-02", today: "2026-10-04" });
  assert.equal(d.length, 31);
  assert.equal(monthDays({ year: 2026, month: 1 }, [], {}).length, 28);
  assert.deepEqual(d[0], {
    day: 1,
    date: "2026-10-01",
    kcal: 52.4,
    logged: true,
    open: false,
    today: false,
  });
  assert.deepEqual(d[1], {
    day: 2,
    date: "2026-10-02",
    kcal: 0,
    logged: false,
    open: true,
    today: false,
  });
  assert.deepEqual(d[3], {
    day: 4,
    date: "2026-10-04",
    kcal: undefined,
    logged: false,
    open: false,
    today: true,
  });
  assert.equal(d[30].date, "2026-10-31");
});

test("weight entry: existing row, blanks, new", () => {
  const log = [{ date: "2026-10-02", week: 0, dose: "", actual: 84.2 }];
  assert.deepEqual(entryFor(log, "2026-10-02"), {
    date: "2026-10-02",
    week: 0,
    dose: "",
    projected: "",
    actual: 84.2,
    existing: true,
  });
  assert.deepEqual(entryFor(log, "2026-10-05"), {
    date: "2026-10-05",
    week: "",
    dose: "",
    projected: "",
    actual: "",
    existing: false,
  });
});

test("numbers: trimmed; blank or unreadable → null", () => {
  assert.equal(numberOrNull(" 4 "), 4);
  assert.equal(numberOrNull("0"), 0);
  assert.equal(numberOrNull(83.4), 83.4);
  assert.equal(numberOrNull(""), null);
  assert.equal(numberOrNull("  "), null);
  assert.equal(numberOrNull("abc"), null);
  assert.equal(numberOrNull("Infinity"), null);
});

test("saved row and log updates", () => {
  const entry = {
    date: "d",
    week: " 2",
    dose: " 5mg ",
    projected: "",
    actual: "x",
    existing: true,
  };
  assert.deepEqual(weightRow(entry), {
    date: "d",
    week: 2,
    dose: "5mg",
    projected: null,
    actual: null,
  });
  assert.equal(weightRow({ ...entry, dose: 5 }).dose, "5");
  assert.equal(weightRow({ ...entry, projected: "84.0" }).projected, 84);
  const log = [{ date: "2026-10-03" }, { date: "2026-10-01", actual: 1 }];
  assert.deepEqual(withWeightRow(log, { date: "2026-10-01", actual: 2 }), [
    { date: "2026-10-01", actual: 2 },
    { date: "2026-10-03" },
  ]);
  assert.deepEqual(withWeightRow([{}, { date: "b" }], { date: "a" }), [
    {},
    { date: "a" },
    { date: "b" },
  ]);
  assert.deepEqual(withoutWeightRow(log, "2026-10-03"), [{ date: "2026-10-01", actual: 1 }]);
  assert.equal(log.length, 2); // not mutated
});
