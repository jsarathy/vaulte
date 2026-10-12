// tests/errorLog.test.mjs — the app error log (src/lib/errorLog.js, Fix 98 part 2): what an entry
// holds, the limits on how many are recorded, and how the log is shown and searched.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_COLUMNS,
  MAX_MESSAGE,
  MAX_PER_LOAD,
  MAX_STACK,
  REPEAT_MS,
  countSince,
  entryFor,
  errorCells,
  errorsCount,
  filterErrors,
  isIgnored,
  makeLimiter,
  messageOf,
  stackOf,
} from "../src/lib/errorLog.js";

test("messageOf: strings, errors and error-like objects joined; anything else is [object]", () => {
  assert.equal(
    messageOf(["weight save failed", new Error("Mock setDoc failure")]),
    "weight save failed Mock setDoc failure",
  );
  assert.equal(messageOf([{ message: "from an object" }]), "from an object");
  assert.equal(messageOf(["a", { notAMessage: 1 }, null, 5]), "a [object] [object] [object]");
  assert.equal(messageOf(["  lots   of\n  space  "]), "lots of space");
  assert.equal(messageOf([]), "");
});

test("messageOf: cut at 300 characters", () => {
  assert.equal(MAX_MESSAGE, 300);
  assert.equal(messageOf(["x".repeat(500)]).length, 300);
  assert.equal(messageOf(["x".repeat(300)]).length, 300);
  assert.equal(messageOf(["x".repeat(299)]).length, 299);
});

test("a message never carries the data an error was about: objects are not spelled out", () => {
  const secret = { weight: 83.4, notes: "my medication" };
  assert.doesNotMatch(messageOf(["save failed", secret]), /83\\.4|medication/);
});

test("stackOf: the first four lines of the first argument that has a stack, cut short; else empty", () => {
  const e = new Error("boom");
  e.stack = "Error: boom\n at a\n at b\n at c\n at d\n at e";
  assert.equal(stackOf(["text", e]), "Error: boom\n at a\n at b\n at c");
  e.stack = "x".repeat(900);
  assert.equal(stackOf([e]).length, MAX_STACK);
  assert.equal(stackOf(["no stack here", { message: "m" }]), "");
  assert.equal(stackOf([]), "");
});

test("entryFor: when, kind, page and message; the stack only when there is one", () => {
  const now = new Date("2026-10-12T14:32:00.000Z");
  assert.deepEqual(entryFor("console", ["load failed"], "/app.html", now), {
    at: "2026-10-12T14:32:00.000Z",
    source: "console",
    page: "/app.html",
    message: "load failed",
  });
  const e = new Error("boom");
  e.stack = "Error: boom\n at x";
  assert.deepEqual(entryFor("error", [e], "/", now), {
    at: "2026-10-12T14:32:00.000Z",
    source: "error",
    page: "/",
    message: "boom",
    stack: "Error: boom\n at x",
  });
  assert.ok(entryFor("promise", ["x"], "/").at.startsWith("20")); // no time given: now
});

test("isIgnored: empty messages and ResizeObserver noise", () => {
  assert.equal(isIgnored(""), true);
  assert.equal(isIgnored(undefined), true);
  assert.equal(isIgnored("ResizeObserver loop completed with undelivered notifications."), true);
  assert.equal(isIgnored("resizeobserver loop limit exceeded"), true);
  assert.equal(isIgnored("weight save failed"), false);
});

test("makeLimiter: the same message at most once a minute, and 30 messages in all", () => {
  assert.equal(REPEAT_MS, 60_000);
  assert.equal(MAX_PER_LOAD, 30);
  const allowed = makeLimiter();
  assert.equal(allowed("a", 1_000_000), true);
  assert.equal(allowed("a", 1_000_000 + 59_999), false); // too soon
  assert.equal(allowed("b", 1_000_000 + 59_999), true); // a different message
  assert.equal(allowed("a", 1_000_000 + 60_000), true); // a minute later
  const full = makeLimiter();
  for (let i = 0; i < 30; i++) assert.equal(full(`m${i}`, 5), true, `m${i}`);
  assert.equal(full("one more", 5), false); // 31st
  assert.equal(full("m0", 5 + 10 * 60_000), false); // not even after the wait: the cap is per page load
  assert.equal(makeLimiter()("x"), true); // no time given: now
});

const E1 = {
  at: "2026-10-12T14:32:00.000Z",
  source: "console",
  page: "/app.html",
  message: "Weight save failed Mock setDoc failure",
};
const E2 = {
  at: "2026-10-10T08:05:00.000Z",
  source: "promise",
  page: "/tracker.html",
  message: "Network down",
};
const E3 = {
  at: "2026-10-01T09:00:00.000Z",
  source: "error",
  page: "/app.html",
  message: "Cannot read properties of undefined",
};

test("the columns and a row's cells; an unknown kind is shown as it is", () => {
  process.env.TZ = "UTC";
  assert.deepEqual(ERROR_COLUMNS, ["Date", "Kind", "Page", "Message"]);
  assert.deepEqual(errorCells(E1), [
    "12-Oct-2026 14:32",
    "Logged",
    "/app.html",
    "Weight save failed Mock setDoc failure",
  ]);
  assert.equal(errorCells(E2)[1], "Promise");
  assert.equal(errorCells(E3)[1], "Error");
  assert.deepEqual(errorCells({ source: "custom" }), ["", "custom", "", ""]);
  assert.deepEqual(errorCells({}), ["", "", "", ""]);
});

test("filterErrors: every word must be in the row, in any case", () => {
  process.env.TZ = "UTC";
  const all = [E1, E2, E3];
  const ats = (list) => list.map((e) => e.at);
  assert.equal(filterErrors(all, ""), all);
  assert.equal(filterErrors(all, "  "), all);
  assert.equal(filterErrors(all, undefined), all);
  assert.deepEqual(ats(filterErrors(all, "WEIGHT")), [E1.at]); // message
  assert.deepEqual(ats(filterErrors(all, "tracker")), [E2.at]); // page
  assert.deepEqual(ats(filterErrors(all, "promise")), [E2.at]); // kind
  assert.deepEqual(ats(filterErrors(all, "oct-2026")), [E1.at, E2.at, E3.at]); // the date as shown
  assert.deepEqual(ats(filterErrors(all, "10-Oct")), [E2.at]);
  assert.deepEqual(ats(filterErrors(all, "app.html failed")), [E1.at]);
  assert.deepEqual(filterErrors(all, "app.html network"), []);
  assert.deepEqual(filterErrors(all, "logged/app.html"), []); // a word cannot run across two cells
  assert.deepEqual(filterErrors([], "x"), []);
});

test("countSince: entries from the last N days", () => {
  const now = new Date("2026-10-12T15:00:00.000Z");
  assert.equal(countSince([E1, E2, E3], 7, now), 2);
  assert.equal(countSince([E1, E2, E3], 1, now), 1);
  assert.equal(countSince([E1, E2, E3], 30, now), 3);
  assert.equal(countSince([E1, E2, E3], 0, now), 0);
  assert.equal(countSince([{ message: "no time" }, { at: "garbage" }], 7, now), 0);
  assert.equal(countSince([], 7, now), 0);
  // exactly 7 days old still counts; a millisecond older does not
  const sevenDays = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const older = new Date(now.getTime() - 7 * 86_400_000 - 1).toISOString();
  assert.equal(countSince([{ at: sevenDays }], 7, now), 1);
  assert.equal(countSince([{ at: older }], 7, now), 0);
  assert.equal(countSince([{ at: new Date().toISOString() }], 7), 1); // no 'now' given
});

test("errorsCount: singular and plural", () => {
  assert.equal(errorsCount(0), "0 errors");
  assert.equal(errorsCount(1), "1 error");
  assert.equal(errorsCount(2), "2 errors");
});
