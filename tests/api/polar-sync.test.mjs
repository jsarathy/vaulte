// tests/api/polar-sync.test.mjs — POST /api/polar-sync against the Firestore emulator.
// Polar's AccessLink API is stubbed (global fetch) — no network.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import handler from "../../api/polar-sync.js";

const UID = "user-1";
const CONN = `users/${UID}/polar/connection`;
const POLAR = "https://www.polaraccesslink.com";
const TX = `${POLAR}/v3/users/777/exercise-transactions`;
const EX = (id) => `${TX}/42/exercises/${id}`;
const AUTH = { Authorization: "Bearer tok-abc", Accept: "application/json" };
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const realFetch = globalThis.fetch;
let calls;
/** Serve Polar from a { [url]: reply | (opts) => reply } map; a reply is { status, json?, text? }. */
const stubPolar = (routes) => {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes("polaraccesslink.com")) return realFetch(url, opts); // only Polar is stubbed
    calls.push({ url: u, method: opts.method || "GET", headers: opts.headers });
    const route = routes[`${opts.method || "GET"} ${u}`] ?? routes[u];
    if (route === undefined) throw new Error(`unexpected Polar call ${opts.method || "GET"} ${u}`);
    const r = typeof route === "function" ? await route(opts) : route;
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? ""),
    };
  };
};
const call = async (body, method = "POST") => {
  const out = res();
  await handler({ method, body }, out);
  return out;
};
const connect = (extra = {}) =>
  db()
    .doc(CONN)
    .set({ connected: true, access_token: "tok-abc", polar_user_id: 777, since: "x", ...extra });
const session = (id) => read(`users/${UID}/polar_sessions/${id}`);

const ok = (json) => ({ status: 200, json });
const exercise = (id, fields = {}) => ({
  id,
  "detailed-sport-info": "INDOOR_CYCLING",
  sport: "CYCLING",
  "start-time": "2026-10-01T07:00:00",
  duration: "PT1H2M30S",
  calories: 512,
  "heart-rate": { average: 131, maximum: 162 },
  "fat-percentage": 38,
  "has-route": true,
  device: "Polar H10",
  ...fields,
});
const samples = (data, extra = {}) => ({
  samples: [
    { "sample-type": "3", data: "1,2,3" },
    { "sample-type": "0", data, "recording-rate": 5, ...extra },
  ],
});
/** A full happy-path route table with two exercises. */
const twoExercises = () => ({
  [`POST ${TX}`]: ok({ "transaction-id": 42 }),
  [`GET ${TX}/42`]: ok({ exercises: [EX(11), EX(12)] }),
  [`PUT ${TX}/42`]: ok({}),
  [EX(11)]: ok(exercise(11)),
  [`${EX(11)}/samples`]: ok(samples("0,0,88,90,0,95", { "recording-rate": 1 })),
  [EX(12)]: ok(exercise(12, { "detailed-sport-info": undefined, sport: "RUNNING" })),
  [`${EX(12)}/samples`]: { status: 404, json: samples("50") }, // an error body is not samples
});

beforeEach(clearFirestore);
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("rejects non-POST and a missing userId; not connected is a 401 with no Polar call", async () => {
  stubPolar({});
  assert.equal((await call({ userId: UID }, "GET")).statusCode, 405);
  assert.equal((await call({ userId: UID }, "PUT")).statusCode, 405);
  assert.equal((await call({})).statusCode, 400);
  assert.equal((await call({ userId: UID })).statusCode, 401); // no connection doc
  await db().doc(CONN).set({ connected: false, access_token: "old" });
  const out = await call({ userId: UID });
  assert.deepEqual([out.statusCode, out.body], [401, { error: "Polar account not connected" }]);
  assert.equal(calls.length, 0);
});

test("nothing new (204): last_sync_at is stamped, nothing else changes", async () => {
  await connect();
  stubPolar({ [`POST ${TX}`]: { status: 204 } });
  const out = await call({ userId: UID });
  assert.deepEqual([out.statusCode, out.body], [200, { newSessions: 0, sessions: [] }]);
  assert.deepEqual(calls, [{ url: TX, method: "POST", headers: AUTH }]);
  const conn = await read(CONN);
  assert.match(conn.last_sync_at, ISO);
  assert.equal(conn.since, "x"); // updated, not replaced
  assert.equal(conn.access_token, "tok-abc");
});

test("a failed transaction is a 502 with Polar's text; nothing stamped", async () => {
  await connect();
  stubPolar({ [`POST ${TX}`]: { status: 500, text: "boom" } });
  const out = await call({ userId: UID });
  assert.deepEqual(
    [out.statusCode, out.body],
    [502, { error: "Failed to create Polar transaction", detail: "boom" }],
  );
  assert.equal((await read(CONN)).last_sync_at, undefined);
});

test("a failed exercise list is a 502; the transaction is not committed", async () => {
  await connect();
  stubPolar({ [`POST ${TX}`]: ok({ "transaction-id": 42 }), [`GET ${TX}/42`]: { status: 503 } });
  const out = await call({ userId: UID });
  assert.deepEqual([out.statusCode, out.body], [502, { error: "Failed to list exercises" }]);
  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [`POST ${TX}`, `GET ${TX}/42`],
  );
  assert.equal((await read(CONN)).last_sync_at, undefined);
});

test("exercises and their HR samples are fetched, the transaction committed, sessions saved", async () => {
  await connect();
  stubPolar(twoExercises());
  const out = await call({ userId: UID });
  assert.equal(out.statusCode, 200, JSON.stringify(out.body));
  assert.equal(out.body.newSessions, 2);
  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [
      `POST ${TX}`,
      `GET ${TX}/42`,
      `GET ${EX(11)}`,
      `GET ${EX(11)}/samples`,
      `GET ${EX(12)}`,
      `GET ${EX(12)}/samples`,
      `PUT ${TX}/42`, // committed only after every sample was fetched
    ],
  );
  assert.ok(calls.every((c) => c.headers.Authorization === "Bearer tok-abc"));
  const s11 = await session("11");
  assert.match(s11.fetched_at, ISO);
  const { fetched_at, ...rest } = s11;
  assert.deepEqual(rest, {
    id: "11",
    sport: "INDOOR_CYCLING",
    start_time: "2026-10-01T07:00:00",
    duration_min: 62.5,
    calories: 512,
    hr_avg: 131,
    hr_max: 162,
    fat_pct: 38,
    has_route: true,
    device: "Polar H10",
    hr_samples: [88, 90, null, 95], // leading zeros dropped, internal zeros → null
    recording_rate_s: 1,
    exercise_url: EX(11),
    polar_user_id: 777,
    logged: false,
  });
  assert.deepEqual(out.body.sessions[0], s11);
  const s12 = await session("12");
  assert.equal(s12.sport, "RUNNING"); // falls back to the plain sport
  assert.equal(s11.sport, "INDOOR_CYCLING"); // the detailed sport wins
  assert.equal(s12.hr_samples, null); // no samples endpoint
  assert.equal(s12.recording_rate_s, null);
  assert.match((await read(CONN)).last_sync_at, ISO);
});

test("sample edge cases: no HR set, all zeros, numeric type, default rate, bad JSON, thrown fetch", async () => {
  await connect();
  const ids = [21, 22, 23, 24, 25];
  stubPolar({
    [`POST ${TX}`]: ok({ "transaction-id": 42 }),
    [`GET ${TX}/42`]: ok({ exercises: ids.map(EX) }),
    [`PUT ${TX}/42`]: ok({}),
    ...Object.fromEntries(ids.map((id) => [EX(id), ok(exercise(id))])),
    [`${EX(21)}/samples`]: ok({ samples: [{ "sample-type": "3", data: "1" }] }),
    [`${EX(22)}/samples`]: ok(samples("0,0,0")),
    [`${EX(23)}/samples`]: ok({ samples: [{ "sample-type": 0, data: "70, 0 ,72" }] }),
    [`${EX(24)}/samples`]: ok({}),
    [`${EX(25)}/samples`]: new Error("socket hang up"),
  });
  const out = await call({ userId: UID });
  assert.equal(out.body.newSessions, 5);
  const hr = async (id) => {
    const s = await session(String(id));
    return [s.hr_samples, s.recording_rate_s];
  };
  assert.deepEqual(await hr(21), [null, null]);
  assert.deepEqual(await hr(22), [null, 5]); // an all-zero set: no samples, rate still read
  assert.deepEqual(await hr(23), [[70, null, 72], 5]); // numeric type, spaces, default rate
  assert.deepEqual(await hr(24), [null, null]);
  assert.deepEqual(await hr(25), [null, null]);
});

test("an exercise that fails or throws is skipped; the rest are still saved", async () => {
  await connect();
  stubPolar({
    [`POST ${TX}`]: ok({ "transaction-id": 42 }),
    [`GET ${TX}/42`]: ok({ exercises: [EX(31), EX(32), EX(33)] }),
    [`PUT ${TX}/42`]: ok({}),
    [EX(31)]: { status: 500, json: exercise(31) }, // an error body is not an exercise
    [EX(32)]: new Error("reset"),
    [EX(33)]: ok({ id: 33, "start-time": "2026-10-02T08:00:00" }), // the barest exercise
    [`${EX(33)}/samples`]: { status: 404 },
  });
  const out = await call({ userId: UID });
  assert.equal(out.body.newSessions, 1);
  assert.equal(await session("31"), undefined);
  assert.equal(await session("32"), undefined);
  const { fetched_at, ...s33 } = await session("33");
  assert.deepEqual(s33, {
    id: "33",
    sport: "OTHER",
    start_time: "2026-10-02T08:00:00",
    duration_min: 0,
    calories: 0,
    hr_avg: null,
    hr_max: null,
    fat_pct: null,
    has_route: false,
    device: null,
    hr_samples: null,
    recording_rate_s: null,
    exercise_url: EX(33),
    polar_user_id: 777,
    logged: false,
  });
  assert.equal(calls.filter((c) => c.method === "PUT").length, 1);
});

test("an empty transaction list saves nothing but still commits and stamps", async () => {
  await connect();
  stubPolar({
    [`POST ${TX}`]: ok({ "transaction-id": 42 }),
    [`GET ${TX}/42`]: ok({}),
    [`PUT ${TX}/42`]: ok({}),
  });
  const out = await call({ userId: UID });
  assert.deepEqual(out.body, { newSessions: 0, sessions: [] });
  assert.equal(calls.at(-1).method, "PUT");
  assert.match((await read(CONN)).last_sync_at, ISO);
});

test("an unexpected failure is a 500 with the message", async () => {
  await connect();
  stubPolar({
    [`POST ${TX}`]: ok({ "transaction-id": 42 }),
    [`GET ${TX}/42`]: ok({ exercises: [] }),
    [`PUT ${TX}/42`]: new Error("commit exploded"),
  });
  const out = await call({ userId: UID });
  assert.deepEqual([out.statusCode, out.body], [500, { error: "commit exploded" }]);
});
