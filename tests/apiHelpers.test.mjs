// tests/apiHelpers.test.mjs — the pure helpers under api/ (no Firestore, no network) that the
// mutation run (Fix 81) showed no test guarded: the Apple request checks, Apple sample spreading,
// the Renpho metric filter and the Renpho time-zone offset.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { parseBody, rejection, resolveDate, tokenOk } from "../api/_apple/request.js";
import { bucketSamples, combineSlots, pickSource } from "../api/_apple/samples.js";
import { extractMetrics } from "../api/_renpho/weight.js";
import { girthRecords } from "../api/_renpho/girth.js";

const env = {};
beforeEach(() => {
  for (const k of ["APPLE_SYNC_TOKEN", "APPLE_SYNC_USER_ID"]) env[k] = process.env[k];
});
afterEach(() => {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
const req = (authorization, method = "POST") => ({
  method,
  headers: authorization === undefined ? {} : { authorization },
});

// ---- _apple/request.js
test("tokenOk: the Bearer token must match exactly, however Bearer is spelled or spaced", () => {
  process.env.APPLE_SYNC_TOKEN = "abc";
  assert.equal(tokenOk(req("Bearer abc")), true);
  assert.equal(tokenOk(req("bearer abc")), true);
  assert.equal(tokenOk(req("BEARER   abc")), true); // any number of spaces
  assert.equal(tokenOk(req("Bearer abd")), false);
  assert.equal(tokenOk(req("Bearer abcd")), false);
  assert.equal(tokenOk(req("abc")), true); // a bare token is the token
  assert.equal(tokenOk(req("abBearer c")), false); // "Bearer" only counts at the start
  assert.equal(tokenOk(req(undefined)), false);
  assert.equal(tokenOk({ headers: {} }), false);
});

test("tokenOk: with no token configured nothing gets in, not even the text a default might spell", () => {
  delete process.env.APPLE_SYNC_TOKEN;
  assert.equal(tokenOk(req("Bearer Stryker was here!")), false);
  assert.equal(tokenOk(req("")), false);
  process.env.APPLE_SYNC_TOKEN = "Stryker was here!";
  assert.equal(tokenOk(req(undefined)), false); // a missing header is not a token
});

test("parseBody: objects, JSON text and Buffers; empty is {}; text that is not JSON is null", () => {
  assert.deepEqual(parseBody({ a: 1 }), { a: 1 });
  assert.deepEqual(parseBody('{"a":1}'), { a: 1 });
  assert.deepEqual(parseBody(Buffer.from('{"a":2}')), { a: 2 });
  assert.deepEqual(parseBody(undefined), {});
  assert.deepEqual(parseBody(null), {});
  assert.deepEqual(parseBody("null"), {});
  assert.equal(parseBody("{nope"), null);
});

test("resolveDate: an ISO date wins, then Shortcuts' date text, then today for no date at all", () => {
  assert.equal(resolveDate("2026-10-04"), "2026-10-04");
  assert.equal(resolveDate("Sent 2026-10-04 at 9"), "2026-10-04");
  assert.equal(resolveDate("4 Oct 2026"), "2026-10-04");
  assert.equal(resolveDate("Oct 4, 2026"), "2026-10-04");
  assert.equal(resolveDate("04/10/2026"), "2026-10-04");
  assert.equal(resolveDate("next tuesday"), null);
  assert.match(resolveDate(undefined), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(resolveDate(""), /^\d{4}-\d{2}-\d{2}$/);
});

test("rejection: wrong method, wrong token and an unset user are refused in that order, with their messages", () => {
  process.env.APPLE_SYNC_TOKEN = "abc";
  process.env.APPLE_SYNC_USER_ID = "u1";
  assert.deepEqual(rejection(req("Bearer abc", "GET")), {
    status: 405,
    error: "Method not allowed",
  });
  assert.deepEqual(rejection(req("Bearer nope")), { status: 401, error: "Unauthorized" });
  delete process.env.APPLE_SYNC_USER_ID;
  assert.deepEqual(rejection(req("Bearer abc")), {
    status: 500,
    error: "APPLE_SYNC_USER_ID not configured",
  });
  process.env.APPLE_SYNC_USER_ID = "u1";
  assert.equal(rejection(req("Bearer abc")), null);
});

// ---- _apple/samples.js
const sample = (s, e, v, src = "Watch") => ({ s, e, v, src });

test("pickSource: Watch samples only when there are any; nothing from a non-list", () => {
  const phone = sample("2026-10-04 08:00", "2026-10-04 08:05", 5, "iPhone");
  const watch = sample("2026-10-04 08:00", "2026-10-04 08:05", 7, "Apple Watch");
  assert.deepEqual(pickSource([phone, watch]), [watch]);
  assert.deepEqual(pickSource([phone]), [phone]);
  assert.deepEqual(pickSource([null, watch, undefined]), [watch]);
  assert.deepEqual(pickSource([phone, { v: 1 }]), [phone, { v: 1 }]);
  assert.deepEqual(pickSource(null), []);
  assert.deepEqual(pickSource("samples"), []);
});

test("bucketSamples: a window is spread pro rata over the 5-minute slots it touches", () => {
  const out = bucketSamples([sample("2026-10-04 08:02", "2026-10-04 08:12", 100)], "2026-10-04");
  // 10 minutes: 3 in slot 480, 5 in 485, 2 in 490
  assert.deepEqual(out, { 480: 30, 485: 50, 490: 20 });
});

test("bucketSamples: an instant lands in its slot, midnight included; no value or no start is skipped", () => {
  assert.deepEqual(
    bucketSamples([sample("2026-10-04 00:00", "2026-10-04 00:00", 4)], "2026-10-04"),
    { 0: 4 },
  );
  assert.deepEqual(bucketSamples([sample("2026-10-04 08:07", undefined, 3)], "2026-10-04"), {
    485: 3,
  });
  assert.deepEqual(
    bucketSamples([sample("2026-10-04 08:07", "2026-10-04 08:07", 0)], "2026-10-04"),
    {},
  );
  assert.deepEqual(
    bucketSamples([sample("2026-10-04 08:07", "2026-10-04 08:07", -2)], "2026-10-04"),
    {},
  );
  assert.deepEqual(bucketSamples([sample("nope", "nope", 5)], "2026-10-04"), {});
  assert.deepEqual(bucketSamples([null, sample("2026-10-04 08:07", undefined, 3)], "2026-10-04"), {
    485: 3,
  });
  // with no Watch samples a missing sample reaches the parser itself
  const phone = sample("2026-10-04 08:07", undefined, 3, "iPhone");
  assert.deepEqual(bucketSamples([null, phone, undefined], "2026-10-04"), { 485: 3 });
});

test("bucketSamples: a sample over midnight counts only the part on the day asked for", () => {
  const night = [sample("2026-10-03 23:50", "2026-10-04 00:10", 20)];
  assert.deepEqual(bucketSamples(night, "2026-10-04"), { 0: 5, 5: 5 }); // 10 of 20 minutes are on the 4th
  assert.deepEqual(bucketSamples(night, "2026-10-03"), { 1430: 5, 1435: 5 });
  assert.deepEqual(bucketSamples(night, "2026-10-05"), {});
});

test("combineSlots: slots side by side, rounded, empty ones dropped; totals from what is kept", () => {
  const steps = { 480: 12.34, 485: 0.01 };
  const active = { 480: 1.234 };
  const flights = { 485: 0.04 };
  const out = combineSlots([steps, active, flights]);
  assert.deepEqual(out.slots, { "0800": [12.3, 1.23, 0] }); // 0805 rounds to nothing and is dropped
  assert.deepEqual(out.totals, { steps: 12, activeMin: 1, flights: 0 });
});

// ---- _renpho/weight.js
test("extractMetrics: numbers on the record, to 2 dp; bookkeeping fields, zeros and non-numbers are dropped", () => {
  const out = extractMetrics({
    bmi: 27.456,
    bodyfat: "21.5",
    zero: 0,
    blank: "",
    word: "abc",
    nothing: null,
    nested: {},
    yes: true,
    inf: Infinity,
    weight: 80,
  });
  assert.deepEqual(out, { bmi: 27.46, bodyfat: 21.5, weight: 80 });
  assert.deepEqual(extractMetrics(null), {});
});

test("extractMetrics: each bookkeeping word drops a field, but only where it is meant to", () => {
  const dropped = [
    "userId",
    "bodyIds",
    "createTime",
    "timeStamp",
    "measureDate",
    "created",
    "updated",
    "weightUnit",
    "bodyType",
    "isFlag",
    "status",
    "version",
    "macAddress",
    "sn",
    "serialNo",
    "scaleName",
    "tableName",
    "deviceId",
    "sex",
    "gender",
    "age",
    "height",
    "method",
    "workMode",
    "localId",
    "timeZone",
    "dataSource",
    "deleted",
    "isSync",
    "tz",
  ];
  const kept = ["idx", "idsx", "snack", "ssn", "page", "agex", "xlocal", "xtz", "bmi", "waterRate"];
  const all = Object.fromEntries([...dropped, ...kept].map((k) => [k, 5]));
  assert.deepEqual(Object.keys(extractMetrics(all)).sort(), [...kept].sort());
});

// ---- _renpho/girth.js
test("girth: the reading's date is where it was taken, from the device's UTC offset", () => {
  const ts = Date.UTC(2026, 9, 4, 23, 30) / 1000; // 23:30 UTC on 4 Oct
  const dateWith = (timeZone) =>
    girthRecords([{ timeStamp: ts, timeZone, leftArmValue: 30 }])[0].date;
  assert.equal(dateWith("+1:00"), "2026-10-05");
  assert.equal(dateWith("+0:30"), "2026-10-05");
  assert.equal(dateWith("+10"), "2026-10-05");
  assert.equal(dateWith("1"), "2026-10-05"); // no sign counts as plus
  assert.equal(dateWith("+5.25"), "2026-10-05");
  assert.equal(dateWith(" +1:00 "), "2026-10-05");
  assert.equal(dateWith("-5"), "2026-10-04");
  assert.equal(dateWith("-8:30"), "2026-10-04");
  assert.equal(dateWith("+0"), "2026-10-04");
  assert.equal(dateWith("abc"), "2026-10-04"); // unreadable: no offset
  assert.equal(dateWith("+1:00abc"), "2026-10-04");
  assert.equal(dateWith("abc+1"), "2026-10-04");
  assert.equal(dateWith(undefined), "2026-10-04");
  assert.equal(dateWith(null), "2026-10-04");
});
