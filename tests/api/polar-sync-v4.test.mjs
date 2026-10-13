// tests/api/polar-sync-v4.test.mjs — POST /api/polar-sync with Polar's newer API (Fix 125): new
// sessions that come back without heart rate read it from v4, and a few older stored sessions with
// none are filled quietly, each asked once. Polar is stubbed (global fetch); Firestore is the emulator.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import handler, { deps } from "../../api/polar-sync.js";

deps.verify = async (token) => ({ uid: token.slice(4) }); // "tok-<uid>"

const UID = "user-1";
const CONN = `users/${UID}/polar/connection`;
const V4_CONN = `users/${UID}/polar/connection_v4`;
const POLAR = "https://www.polaraccesslink.com";
const TX = `${POLAR}/v3/users/777/exercise-transactions`;
const V3 = `${POLAR}/v3/exercises?samples=true`;
const V4 = `${POLAR}/v4/data/training-sessions/list`;
const TOKEN = "https://auth.polar.com/oauth/token";
const EX = (id) => `${TX}/42/exercises/${id}`;
const ok = (json) => ({ status: 200, json });

const realFetch = globalThis.fetch;
const realNow = Date.now;
let calls;

/** Serve Polar from `routes`, and v4's day lists from `days` ({ "2026-10-01": [v4 sessions] }). */
const stubPolar = (routes, days = {}, onV4) => {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes("polaraccesslink.com") && !u.includes("auth.polar.com"))
      return realFetch(url, opts);
    const key = `${opts.method || "GET"} ${u}`;
    calls.push(key);
    let r;
    if (u.startsWith(V4)) {
      onV4?.(u);
      const from = new URL(u).searchParams.get("from").slice(0, 10);
      const day = days[from];
      r = day instanceof Error ? day : day?.status ? day : ok({ trainingSessions: day || [] });
    } else r = routes[key] ?? routes[u];
    if (r === undefined) throw new Error(`unexpected Polar call ${key}`);
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? ""),
    };
  };
};
const v4calls = () => calls.filter((c) => c.includes("/v4/data/"));

const call = async () => {
  const out = res();
  await handler({ method: "POST", headers: { authorization: `Bearer tok-${UID}` }, body: {} }, out);
  return out;
};
const connectV3 = () =>
  db().doc(CONN).set({ connected: true, access_token: "tok-abc", polar_user_id: 777 });
const connectV4 = (extra = {}) =>
  db()
    .doc(V4_CONN)
    .set({
      access_token: "tok-v4",
      refresh_token: "ref-1",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      ...extra,
    });
const stored = (id, fields = {}) =>
  db()
    .doc(`users/${UID}/polar_sessions/${id}`)
    .set({ id, sport: "RUNNING", hr_samples: null, recording_rate_s: null, ...fields });
const session = (id) => read(`users/${UID}/polar_sessions/${id}`);

/** A v4 session starting at 07:00 local (UTC+3) on the date, with a heart-rate series. */
const v4session = (date, values = [0, 100, 110, 120]) => ({
  startTime: `${date}T04:00:00Z`,
  timezoneOffsetMinutes: 180,
  exercises: [{ samples: { samples: [{ type: "HEART_RATE", intervalMillis: 5000, values }] } }],
});
const START = (date) => `${date}T07:00:00`;

const exercise = (id, date) => ({
  id,
  sport: "RUNNING",
  "start-time": START(date),
  duration: "PT30M",
  calories: 300,
});
/** v3 steps for one new exercise that comes with no heart rate anywhere in v3. */
const oneNew = (id, date) => ({
  [`POST ${TX}`]: ok({ "transaction-id": 42 }),
  [`GET ${TX}/42`]: ok({ exercises: [EX(id)] }),
  [`PUT ${TX}/42`]: ok({}),
  [EX(id)]: ok(exercise(id, date)),
  [`${EX(id)}/samples`]: { status: 404, text: "none" },
  [V3]: ok([]),
});
const nothingNew = () => ({ [`POST ${TX}`]: { status: 204 } });

beforeEach(async () => {
  await clearFirestore();
  process.env.POLAR_CLIENT_ID = "client-123"; // for refreshing the v4 token
  process.env.POLAR_CLIENT_SECRET = "secret-456";
  mock.method(console, "warn", () => {});
  mock.method(console, "log", () => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
  mock.restoreAll();
});

test("a new session that came without heart rate gets it from v4, before the transaction is committed", async () => {
  await connectV3();
  await connectV4();
  stubPolar(oneNew("11", "2026-10-01"), { "2026-10-01": [v4session("2026-10-01")] });
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.newSessions, 1);
  assert.equal("hrBackfilled" in out.body, false); // nothing older to fill
  const s = await session("11");
  assert.deepEqual(s.hr_samples, [100, 110, 120]); // the leading zero dropped
  assert.equal(s.recording_rate_s, 5);
  assert.equal(s.hr_v4_checked_at, undefined);
  assert.deepEqual(out.body.sessions[0].hr_samples, [100, 110, 120]);
  const order = calls
    .map((c) => (c.includes("/v4/data/") ? "v4" : c.startsWith("PUT") ? "commit" : null))
    .filter(Boolean);
  assert.deepEqual(order, ["v4", "commit"]);
  assert.equal(v4calls()[0].startsWith(`GET ${V4}?`), true);
});

test("a new session that already has heart rate is not looked up in v4", async () => {
  await connectV3();
  await connectV4();
  const routes = oneNew("11", "2026-10-01");
  routes[`${EX("11")}/samples`] = ok({
    samples: [{ "sample-type": "0", data: "80,82", "recording-rate": 1 }],
  });
  stubPolar(routes);
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.deepEqual((await session("11")).hr_samples, [80, 82]);
  assert.deepEqual(v4calls(), []);
});

test("without a v4 sign-in a sync is as it was: no v4 or token calls, no extra fields", async () => {
  await connectV3();
  await stored("old", { start_time: START("2026-09-20") });
  stubPolar(oneNew("11", "2026-10-01"));
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal((await session("11")).hr_samples, null);
  assert.equal(
    calls.some((c) => c.includes("/v4/") || c.includes("auth.polar.com")),
    false,
  );
  assert.deepEqual(Object.keys(out.body).sort(), ["newSessions", "sessions"]);
  assert.equal((await session("old")).hr_v4_checked_at, undefined);
});

test("older sessions without heart rate are filled, newest first, three a sync, each asked once", async () => {
  await connectV3();
  await connectV4();
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"];
  for (const d of dates) await stored(`s${d}`, { start_time: START(d) });
  const days = Object.fromEntries(
    dates.filter((d) => d !== "2026-09-04").map((d) => [d, [v4session(d)]]),
  );
  stubPolar(nothingNew(), days);

  let out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.hrBackfilled, 2); // 09-05, 09-04 (v4 has none), 09-03: two filled
  for (const d of ["2026-09-05", "2026-09-03"])
    assert.deepEqual((await session(`s${d}`)).hr_samples, [100, 110, 120], d);
  assert.equal((await session("s2026-09-04")).hr_samples, null);
  assert.match((await session("s2026-09-04")).hr_v4_checked_at, /^\d{4}-/); // asked, v4 had none
  assert.match((await session("s2026-09-05")).hr_v4_checked_at, /^\d{4}-/);
  assert.equal((await session("s2026-09-02")).hr_v4_checked_at, undefined); // not reached yet
  assert.equal((await session("s2026-09-01")).hr_v4_checked_at, undefined);

  stubPolar(nothingNew(), days);
  out = await call();
  assert.equal(out.body.hrBackfilled, 2); // 09-02 and 09-01; the three asked before are not asked again
  assert.deepEqual((await session("s2026-09-01")).hr_samples, [100, 110, 120]);
  assert.equal(
    v4calls().some((c) => c.includes("from=2026-09-04") || c.includes("from=2026-09-05")),
    false,
  );

  stubPolar(nothingNew(), days);
  out = await call();
  assert.equal("hrBackfilled" in out.body, false); // all asked: nothing left to do
  assert.deepEqual(v4calls(), []);
});

test("backfill leaves alone sessions that have heart rate, no start time, or were asked before", async () => {
  await connectV3();
  await connectV4();
  await stored("has", {
    start_time: START("2026-09-10"),
    hr_samples: [90, 95],
    recording_rate_s: 5,
  });
  await stored("nodate", {});
  await stored("asked", {
    start_time: START("2026-09-11"),
    hr_v4_checked_at: "2026-10-01T00:00:00.000Z",
  });
  stubPolar(nothingNew(), {
    "2026-09-10": [v4session("2026-09-10")],
    "2026-09-11": [v4session("2026-09-11")],
  });
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal("hrBackfilled" in out.body, false);
  assert.deepEqual(v4calls(), []);
  assert.deepEqual((await session("has")).hr_samples, [90, 95]);
  assert.equal((await session("asked")).hr_samples, null);
});

test("a v4 failure never fails the sync, and a session v4 could not answer for is asked again next time", async () => {
  await connectV3();
  await connectV4();
  await stored("s1", { start_time: START("2026-09-05") });
  const failing = { status: 500, text: "down" };
  stubPolar(nothingNew(), { "2026-09-05": failing, "2026-09-04": failing, "2026-09-06": failing });
  let out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal((await session("s1")).hr_v4_checked_at, undefined); // not marked: nothing was answered

  stubPolar(nothingNew(), {
    "2026-09-05": new Error("socket hang up"),
    "2026-09-04": new Error("x"),
    "2026-09-06": new Error("x"),
  });
  out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal((await session("s1")).hr_v4_checked_at, undefined);

  stubPolar(nothingNew(), { "2026-09-05": [v4session("2026-09-05")] }); // v4 back: this time it is found
  out = await call();
  assert.equal(out.body.hrBackfilled, 1);
  assert.deepEqual((await session("s1")).hr_samples, [100, 110, 120]);
});

test("a new session whose v4 lookup fails is still saved, and the transaction is still committed", async () => {
  await connectV3();
  await connectV4();
  const failing = { status: 500, text: "down" };
  stubPolar(oneNew("11", "2026-10-01"), {
    "2026-10-01": failing,
    "2026-09-30": failing,
    "2026-10-02": failing,
  });
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal((await session("11")).hr_samples, null);
  assert.ok(calls.includes(`PUT ${TX}/42`));
});

test("an expired v4 token is refreshed during the sync and the new tokens are stored", async () => {
  await connectV3();
  await connectV4({ expires_at: new Date(Date.now() - 1000).toISOString() });
  await stored("s1", { start_time: START("2026-09-05") });
  stubPolar(
    { ...nothingNew(), [`POST ${TOKEN}`]: ok({ access_token: "fresh", expires_in: 3600 }) },
    { "2026-09-05": [v4session("2026-09-05")] },
  );
  const out = await call();
  assert.equal(out.body.hrBackfilled, 1);
  const conn = await read(V4_CONN);
  assert.equal(conn.access_token, "fresh");
  assert.equal(conn.refresh_token, "ref-1");
});

test("the v4 lookups stop when the time budget is spent: the rest are not asked and are left for the next sync", async () => {
  await connectV3();
  await connectV4();
  let t = realNow(); // the stored token is good for an hour from now
  Date.now = () => t;
  for (const d of ["2026-09-03", "2026-09-04", "2026-09-05"])
    await stored(`s${d}`, { start_time: START(d) });
  const days = Object.fromEntries(
    ["2026-09-03", "2026-09-04", "2026-09-05"].map((d) => [d, [v4session(d)]]),
  );
  stubPolar(nothingNew(), days, () => {
    t += 9000; // the first v4 request takes the whole budget
  });
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.hrBackfilled, 1);
  assert.equal(v4calls().length, 1);
  assert.deepEqual((await session("s2026-09-05")).hr_samples, [100, 110, 120]);
  for (const d of ["2026-09-04", "2026-09-03"])
    assert.equal((await session(`s${d}`)).hr_v4_checked_at, undefined, d);
});

test("with no sessions stored and nothing new, a v4 sign-in costs no Polar calls beyond the transaction", async () => {
  await connectV3();
  await connectV4();
  stubPolar(nothingNew());
  const out = await call();
  assert.deepEqual([out.statusCode, out.body], [200, { newSessions: 0, sessions: [] }]);
  assert.deepEqual(calls, [`POST ${TX}`]);
});

test("the time budget is spent only when it is passed, not when it is reached exactly", async () => {
  await connectV3();
  await connectV4();
  let t = realNow();
  Date.now = () => t;
  const dates = ["2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
  for (const d of dates) await stored(`s${d}`, { start_time: START(d) });
  const days = Object.fromEntries(dates.map((d) => [d, [v4session(d)]]));
  stubPolar(nothingNew(), days, () => {
    t += 8000; // each request takes exactly the whole budget
  });
  const out = await call();
  // three are due (the newest): the first asks at the start, the second when the budget is exactly
  // spent (still allowed), the third when it is passed (not asked)
  assert.equal(out.body.hrBackfilled, 2);
  assert.equal(v4calls().length, 2);
  assert.equal((await session("s2026-09-04")).hr_v4_checked_at, undefined);
});

test("a session is marked as asked when v4 answered for any of the days, even if another day's request failed", async () => {
  await connectV3();
  await connectV4();
  await stored("s1", { start_time: START("2026-09-05") });
  stubPolar(nothingNew(), {
    "2026-09-05": [],
    "2026-09-04": { status: 500, text: "down" },
    "2026-09-06": [],
  });
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.equal("hrBackfilled" in out.body, false);
  assert.match((await session("s1")).hr_v4_checked_at, /^\d{4}-/);
  assert.equal(v4calls().length, 3);
});

test("a v4 lookup that throws is logged and does not stop the rest; a person without v4 logs nothing", async () => {
  await connectV3();
  await connectV4();
  await stored("s1", { start_time: START("2026-09-05") });
  const boom = new Error("socket hang up");
  stubPolar(nothingNew(), { "2026-09-05": boom, "2026-09-04": boom, "2026-09-06": boom });
  await call();
  assert.deepEqual(
    console.warn.mock.calls.map((c) => c.arguments),
    [["Polar v4 lookup failed:", "socket hang up"]],
  );
  mock.restoreAll();
  mock.method(console, "warn", () => {});
  await clearFirestore();
  await connectV3();
  await stored("s1", { start_time: START("2026-09-05") });
  stubPolar(oneNew("11", "2026-10-01"));
  await call();
  assert.equal(console.warn.mock.calls.length, 0); // no v4 sign-in: nothing was tried, nothing logged
});

test("a failure while filling older sessions is logged and never fails the sync", async () => {
  await connectV3();
  await connectV4();
  stubPolar(nothingNew());
  const realCollection = Object.getPrototypeOf(db()).collection;
  mock.method(Object.getPrototypeOf(db()), "collection", function (path) {
    if (String(path).includes("polar_sessions")) throw new Error("index is building");
    return realCollection.call(this, path);
  });
  const out = await call();
  const warned = console.warn.mock.calls.map((c) => c.arguments);
  mock.restoreAll(); // the broken collection() first, so the checks below can read
  assert.deepEqual([out.statusCode, out.body], [200, { newSessions: 0, sessions: [] }]);
  assert.deepEqual(warned, [["Polar heart-rate history not finished:", "index is building"]]);
});
