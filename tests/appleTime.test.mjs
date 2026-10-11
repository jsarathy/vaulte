// tests/appleTime.test.mjs — api/_apple/time.js: the times and lists an iOS Shortcut sends (Fix 81)
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { parseLocal, parseLoose, toList, todayUK } from "../api/_apple/time.js";

test("parseLocal: an ISO-like timestamp gives its date and the minutes into the day", () => {
  assert.deepEqual(parseLocal("2026-09-24T09:32:10+01:00"), {
    date: "2026-09-24",
    min: 9 * 60 + 32 + 10 / 60,
  });
  assert.deepEqual(parseLocal("2026-09-24 09:32"), { date: "2026-09-24", min: 572 });
  assert.deepEqual(parseLocal("2026-09-24T9:05"), { date: "2026-09-24", min: 545 });
  assert.deepEqual(parseLocal("  2026-09-24T00:00:30  "), { date: "2026-09-24", min: 0.5 });
});

test("parseLocal: text that is not a timestamp at its start gives nothing", () => {
  assert.equal(parseLocal("at 2026-09-24T09:32"), null);
  assert.equal(parseLocal("2026-09-24"), null);
  assert.equal(parseLocal("24/09/2026 09:32"), null);
  assert.equal(parseLocal(""), null);
  assert.equal(parseLocal(null), null);
  assert.equal(parseLocal(undefined), null);
});

test("parseLoose: day first, UK slashes, and month first, with 24-hour times", () => {
  assert.deepEqual(parseLoose("27 Sep 2026 at 07:00"), { date: "2026-09-27", min: 420 });
  assert.deepEqual(parseLoose("27/09/2026, 07:00"), { date: "2026-09-27", min: 420 });
  assert.deepEqual(parseLoose("Sep 27, 2026 at 18:45"), { date: "2026-09-27", min: 18 * 60 + 45 });
  assert.deepEqual(parseLoose("1 Jan 2027 at 00:05"), { date: "2027-01-01", min: 5 });
  assert.deepEqual(parseLoose("5/1/2027 09:00"), { date: "2027-01-05", min: 540 });
});

test("parseLoose: every month name, full or short, upper or lower case", () => {
  const names = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  names.forEach((name, i) => {
    const mm = String(i + 1).padStart(2, "0");
    assert.equal(parseLoose(`3 ${name} 2026 at 10:00`)?.date, `2026-${mm}-03`, name);
    assert.equal(parseLoose(`3 ${name.toUpperCase()} 2026 at 10:00`)?.date, `2026-${mm}-03`, name);
  });
  assert.equal(parseLoose("3 September 2026 at 10:00")?.date, "2026-09-03");
  assert.equal(parseLoose("Sept. 3, 2026 at 10:00")?.date, "2026-09-03");
  assert.equal(parseLoose("3 xyz 2026 at 10:00"), null); // not a month
});

test("parseLoose: spacing and commas in the date vary", () => {
  assert.deepEqual(parseLoose("27   Sep    2026   at 07:00"), { date: "2026-09-27", min: 420 });
  assert.deepEqual(parseLoose("Sep   27,   2026 at 07:00"), { date: "2026-09-27", min: 420 });
  assert.deepEqual(parseLoose("Sep 27 2026 at 07:00"), { date: "2026-09-27", min: 420 });
  assert.deepEqual(parseLoose("Sep 27,2026 at 07:00")?.date, undefined); // a comma needs a space after it
});

test("parseLoose: 12-hour times with AM and PM, noon and midnight, and seconds", () => {
  const at = (t) => parseLoose(`27 Sep 2026 at ${t}`)?.min;
  assert.equal(at("7:00 AM"), 420);
  assert.equal(at("7:00 PM"), 19 * 60);
  assert.equal(at("12:15 AM"), 15);
  assert.equal(at("12:15 PM"), 12 * 60 + 15);
  assert.equal(at("7:00:30 pm"), 19 * 60);
  assert.equal(at("7:00am"), 420);
  assert.equal(at("12:30"), 12 * 60 + 30); // 24-hour: noon stays noon
  assert.equal(at("00:30"), 30);
});

test("parseLoose: a date and a time are both needed", () => {
  assert.equal(parseLoose("27 Sep 2026"), null);
  assert.equal(parseLoose("at 07:00"), null);
  assert.equal(parseLoose(""), null);
  assert.equal(parseLoose(null), null);
  assert.equal(parseLoose("0/0/0000 07:00"), null);
});

test("toList: a JSON array stays, newline text is split with blanks dropped, nothing is empty", () => {
  const arr = [1, 2];
  assert.equal(toList(arr), arr);
  assert.deepEqual(toList("a\nb\r\n\n  c  \n"), ["a", "b", "c"]);
  assert.deepEqual(toList("  x  "), ["x"]);
  assert.deepEqual(toList(null), []);
  assert.deepEqual(toList(undefined), []);
  assert.deepEqual(toList(""), []);
  assert.deepEqual(toList(5), ["5"]);
});

test("todayUK: today's date in London, whatever the server's own time zone", () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-04T23:30:00Z") });
  try {
    // 23:30 UTC on 4 Oct is 00:30 on 5 Oct in London (BST); Los Angeles is still on the 4th
    const before = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      assert.equal(todayUK(), "2026-10-05");
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  } finally {
    mock.timers.reset();
  }
  assert.match(todayUK(), /^\d{4}-\d{2}-\d{2}$/);
});
