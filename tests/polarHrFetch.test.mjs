// tests/polarHrFetch.test.mjs — api/_polar/hrFetch.js: looking up a stored session's heart rate in
// Polar's replies (no Firestore, no network). Cases the mutation run (Fix 81) showed unguarded.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  attemptOf,
  clientHeaders,
  listRecentExercises,
  matchExercise,
  outsideWindow,
  recentFinder,
  safeFetchJSON,
  summariseList,
} from "../api/_polar/hrFetch.js";

const realFetch = globalThis.fetch;
const env = {};
beforeEach(() => {
  mock.method(console, "log", () => {});
  for (const k of ["POLAR_CLIENT_ID", "POLAR_CLIENT_SECRET"]) env[k] = process.env[k];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restoreAll();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});
const reply = (status, text) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => text,
});

test("safeFetchJSON: JSON is parsed; an error, an empty body and text that is not JSON are explained", async () => {
  globalThis.fetch = reply(200, '{"a":1}');
  assert.deepEqual(await safeFetchJSON("u", {}), { ok: true, status: 200, data: { a: 1 } });
  globalThis.fetch = reply(500, "server broke");
  assert.deepEqual(await safeFetchJSON("u", {}), { ok: false, status: 500, body: "server broke" });
  globalThis.fetch = reply(200, "  ");
  assert.deepEqual(await safeFetchJSON("u", {}), { ok: false, status: 200, body: "(empty body)" });
  globalThis.fetch = reply(200, "<html>" + "x".repeat(300));
  const html = await safeFetchJSON("u", {});
  assert.equal(html.ok, false);
  assert.equal(html.body.length, 200); // only the start of it is kept
});

test("safeFetchJSON: logs the address, the status and the body length", async () => {
  globalThis.fetch = reply(404, "gone");
  await safeFetchJSON("https://p/x", {});
  assert.deepEqual(console.log.mock.calls[0].arguments, [
    "polar-fetch-hr: GET https://p/x → 404, body length 4",
  ]);
});

test("attemptOf: a failure carries the start of Polar's reply, never more than 150 characters", () => {
  assert.deepEqual(attemptOf("u", { ok: true, status: 200 }), { url: "u", status: 200, ok: true });
  assert.equal(
    attemptOf("u", { ok: false, status: 500, body: "y".repeat(400) }).detail.length,
    150,
  );
  assert.equal(attemptOf("u", { ok: false, status: 500 }).detail, "");
});

const SESSION = { start_time: "2026-09-03T08:00:00", calories: 400, duration_min: 30 };
const ex = (start, extra = {}) => ({
  start_time: start,
  calories: 400,
  duration: "PT30M",
  ...extra,
});

test("matchExercise: the same start within two minutes, boundary included; the dashed field name counts", () => {
  assert.equal(matchExercise([ex("2026-09-03T08:02:00", { calories: 1 })], SESSION)?.calories, 1);
  assert.equal(matchExercise([ex("2026-09-03T07:58:00", { calories: 2 })], SESSION)?.calories, 2);
  assert.equal(
    matchExercise([{ "start-time": "2026-09-03T08:01:00", calories: 3, duration: "PT1M" }], SESSION)
      ?.calories,
    3,
  );
  assert.equal(matchExercise([ex("2026-09-03T08:02:01", { calories: 1 })], SESSION), null);
  assert.equal(matchExercise([ex("2026-09-03T08:00:00")], { calories: 1 }), null); // a session with no start
});

test("matchExercise: failing that, the same calories and a duration within a minute, starting within a day", () => {
  const later = (extra) => ex("2026-09-03T11:00:00", extra);
  assert.ok(matchExercise([later({ duration: "PT31M" })], SESSION)); // exactly a minute off
  assert.ok(matchExercise([later({ duration: "PT29M" })], SESSION));
  assert.equal(matchExercise([later({ duration: "PT32M" })], SESSION), null);
  assert.equal(matchExercise([later({ calories: 399 })], SESSION), null);
  assert.equal(matchExercise([ex("2026-09-05T08:00:00")], SESSION), null); // two days later
  assert.ok(matchExercise([ex("2026-09-04T07:00:00")], SESSION)); // inside the day
});

test("summariseList: at most eight short lines, with ? for a missing calorie count", () => {
  const list = Array.from({ length: 10 }, (_, i) => ex(`2026-09-0${(i % 9) + 1}T08:00:00`));
  assert.equal(summariseList(list).length, 8);
  assert.deepEqual(summariseList([{ start_time: "2026-09-03T08:00:00", duration: "PT45M30S" }]), [
    "2026-09-03T08:00:00 ? kcal 46 min",
  ]);
});

test("listRecentExercises: a list, an { exercises } object, nothing usable, and an error", async () => {
  globalThis.fetch = reply(200, '[{"a":1},{"a":2}]');
  const arr = await listRecentExercises({});
  assert.equal(arr.list.length, 2);
  assert.equal(arr.attempt.listed, 2);
  globalThis.fetch = reply(200, '{"exercises":[{"a":1}]}');
  assert.equal((await listRecentExercises({})).list.length, 1);
  globalThis.fetch = reply(200, "null");
  assert.equal((await listRecentExercises({})).list, null);
  globalThis.fetch = reply(200, '{"other":1}');
  const none = await listRecentExercises({});
  assert.equal(none.list, null);
  assert.equal(none.attempt.listed, undefined);
  globalThis.fetch = reply(500, "no");
  assert.equal((await listRecentExercises({})).list, null);
});

test("outsideWindow: older than 30 days counted from the fetch time, in the clock Polar reports", () => {
  const day = 86400000;
  const base = Date.parse("2026-09-01T12:00:00Z");
  const session = { fetched_at: "2026-09-01T12:00:00" };
  assert.equal(outsideWindow(session, base + 30 * day), false); // exactly 30 days is still inside
  assert.equal(outsideWindow(session, base + 30 * day + 1000), true);
  assert.equal(outsideWindow({ start_time: "2026-09-01T12:00:00" }, base + 31 * day), true);
  assert.equal(outsideWindow({}, base + 999 * day), false);
  // Polar's text has no zone: it is read as UTC wherever the server runs
  const before = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati";
  try {
    assert.equal(outsideWindow(session, base + 30 * day - 1000), false);
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("clientHeaders: Basic auth from the client id and secret; both are needed", () => {
  assert.deepEqual(clientHeaders({ POLAR_CLIENT_ID: "id", POLAR_CLIENT_SECRET: "sec" }), {
    Authorization: `Basic ${Buffer.from("id:sec").toString("base64")}`,
    Accept: "application/json",
  });
  assert.equal(clientHeaders({ POLAR_CLIENT_ID: "id" }), null);
  assert.equal(clientHeaders({ POLAR_CLIENT_SECRET: "sec" }), null);
  assert.equal(clientHeaders({}), null);
});

test("recentFinder: tries the user's token, then the client credentials, and names each attempt", async () => {
  process.env.POLAR_CLIENT_ID = "id";
  process.env.POLAR_CLIENT_SECRET = "sec";
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    seen.push(opts.headers.Authorization);
    const mine = opts.headers.Authorization.startsWith("Basic");
    const list = mine ? [ex("2026-09-03T08:00:00", { polar_user: "https://p/v3/users/777" })] : [];
    return { ok: true, status: 200, text: async () => JSON.stringify(list) };
  };
  const found = await recentFinder(
    { Authorization: "Bearer u", Accept: "application/json" },
    "777",
  ).find(SESSION);
  assert.ok(found.match);
  assert.deepEqual(
    found.attempts.map((a) => [a.auth, a.matched]),
    [
      ["user token", false],
      ["client credentials", true],
    ],
  );
  assert.deepEqual(seen, ["Bearer u", `Basic ${Buffer.from("id:sec").toString("base64")}`]);
  delete process.env.POLAR_CLIENT_ID;
  const only = await recentFinder({ Authorization: "Bearer u" }, "777").find(SESSION);
  assert.equal(only.match, null);
  assert.deepEqual(
    only.attempts.map((a) => a.auth),
    ["user token"],
  );
});
