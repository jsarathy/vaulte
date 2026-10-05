// tests/api/polar-fetch-hr.test.mjs — POST /api/polar-fetch-hr against the Firestore emulator
// (Fix 26 PR 41). Polar's samples endpoint is stubbed (global fetch) — no network.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import handler from "../../api/polar-fetch-hr.js";

const UID = "user-1";
const SID = "ex-11";
const CONN = `users/${UID}/polar/connection`;
const SESSION = `users/${UID}/polar_sessions/${SID}`;
const POLAR = "https://www.polaraccesslink.com";
const BY_USER = (uid) => `${POLAR}/v3/users/${uid}/exercises/${SID}/samples`;
const EX_URL = `${POLAR}/v3/users/777/exercise-transactions/42/exercises/${SID}`;
const AUTH = { Authorization: "Bearer tok-abc", Accept: "application/json" };

const realFetch = globalThis.fetch;
let calls;
/** Serve Polar from a { [url]: reply } map; a reply is { status, json?, text? } or an Error. */
const stubPolar = (routes) => {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes("polaraccesslink.com")) return realFetch(url, opts);
    calls.push({ url: u, headers: opts.headers });
    const r = routes[u];
    if (r === undefined) throw new Error(`unexpected Polar call ${u}`);
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => r.text ?? JSON.stringify(r.json ?? ""),
    };
  };
};
const quiet = () => {
  const logs = [];
  const log = console.log;
  const error = console.error;
  console.log = (...a) => logs.push(a.join(" "));
  console.error = (...a) => logs.push("ERR " + a.join(" "));
  return { logs, restore: () => Object.assign(console, { log, error }) };
};
const call = async (body, method = "POST") => {
  const out = res();
  await handler({ method, body }, out);
  return out;
};
const connect = (extra = {}) =>
  db()
    .doc(CONN)
    .set({ connected: true, access_token: "tok-abc", polar_user_id: 777, ...extra });
const seed = (fields = {}) =>
  db()
    .doc(SESSION)
    .set({ sport: "CYCLING", duration_s: 3750, ...fields });
const ok = (json) => ({ status: 200, json });
const samples = (data, extra = {}) => ({
  samples: [
    { "sample-type": "3", data: "1,2,3" },
    { "sample-type": "0", data, "recording-rate": 5, ...extra },
  ],
});

let q;
beforeEach(async () => {
  await clearFirestore();
  q = quiet();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  q.restore();
});

test("rejects: method, missing ids", async () => {
  stubPolar({});
  let r = await call({ userId: UID, sessionId: SID }, "GET");
  assert.equal(r.statusCode, 405);
  assert.deepEqual(r.body, { error: "Method not allowed" });
  for (const body of [{}, { userId: UID }, { sessionId: SID }, { userId: "", sessionId: SID }]) {
    r = await call(body);
    assert.equal(r.statusCode, 400);
    assert.deepEqual(r.body, { error: "Missing userId or sessionId" });
  }
  assert.deepEqual(calls, []);
});

test("404 when the session is unknown; 401 when Polar is not connected", async () => {
  stubPolar({});
  let r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 404);
  assert.deepEqual(r.body, { error: "Session not found" });
  await seed();
  r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 401);
  assert.deepEqual(r.body, { error: "Polar not connected" });
  assert.deepEqual(calls, []);
});

test("happy path: the permanent URL by the session's polar user; stored and returned", async () => {
  await seed({ polar_user_id: 888, exercise_url: EX_URL });
  await connect();
  stubPolar({ [BY_USER(888)]: ok(samples("0,0,88,90,0,95", { "recording-rate": 1 })) });
  const r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, { ok: true, hr_samples: [88, 90, null, 95], recording_rate_s: 1 });
  assert.deepEqual(calls, [{ url: BY_USER(888), headers: AUTH }]); // the first URL was enough
  const s = await read(SESSION);
  assert.deepEqual(s.hr_samples, [88, 90, null, 95]);
  assert.equal(s.recording_rate_s, 1);
  assert.equal(s.sport, "CYCLING"); // the rest of the session is kept
  assert.ok(q.logs.some((l) => l.includes(`GET ${BY_USER(888)} → 200`)));
});

test("falls back to the connection's polar user, then the exercise URL", async () => {
  await seed({ exercise_url: EX_URL });
  await connect();
  stubPolar({
    [BY_USER(777)]: { status: 404, json: samples("50") }, // an error body is not samples
    [`${EX_URL}/samples`]: ok(samples(" 70, 72 ,0", { "recording-rate": undefined })),
  });
  const r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, { ok: true, hr_samples: [70, 72, null], recording_rate_s: 5 }); // default rate
  assert.deepEqual(
    calls.map((c) => c.url),
    [BY_USER(777), `${EX_URL}/samples`],
  );
});

test("422 when the session has no Polar identifiers at all", async () => {
  await seed();
  await connect({ polar_user_id: null });
  stubPolar({});
  const r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 422);
  assert.deepEqual(r.body, {
    error: "no_url",
    message: "No Polar identifiers found for this session. Re-sync a fresh session.",
  });
  assert.deepEqual(calls, []);
});

test("502 with the attempts when every URL fails (error, empty body, bad JSON, thrown)", async () => {
  await seed({ exercise_url: EX_URL });
  await connect();
  stubPolar({
    [BY_USER(777)]: { status: 500, text: "boom" },
    [`${EX_URL}/samples`]: { status: 200, text: "   " },
  });
  let r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 502);
  assert.equal(r.body.error, "samples_unavailable");
  assert.match(r.body.message, /^Polar returned no HR sample data\. .*Reconnect button\.$/);
  assert.deepEqual(r.body.attempts, [
    { url: BY_USER(777), status: 500, ok: false },
    { url: `${EX_URL}/samples`, status: 200, ok: false },
  ]);
  assert.equal((await read(SESSION)).hr_samples, undefined);

  stubPolar({ [BY_USER(777)]: { status: 200, text: "<html>not json" } });
  await seed(); // no exercise_url: one URL only
  r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 502);
  assert.deepEqual(r.body.attempts, [{ url: BY_USER(777), status: 200, ok: false }]);

  stubPolar({ [BY_USER(777)]: new Error("socket hang up") }); // a thrown fetch → 500
  r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 500);
  assert.deepEqual(r.body, { error: "socket hang up" });
  assert.ok(q.logs.some((l) => l.startsWith("ERR polar-fetch-hr error:")));
});

test("404 no_hr: no heart-rate channel (types listed), or every value zero", async () => {
  await seed();
  await connect();
  stubPolar({
    [BY_USER(777)]: ok({
      samples: [
        { "sample-type": "3", data: "1,2" },
        { "sample-type": 5, data: "9" },
      ],
    }),
  });
  let r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 404);
  assert.deepEqual(r.body, {
    error: "no_hr",
    message: "No heart rate channel in samples. Available types: [3, 5]",
  });

  stubPolar({ [BY_USER(777)]: ok({}) }); // no samples list at all
  r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 404);
  assert.equal(r.body.message, "No heart rate channel in samples. Available types: []");

  stubPolar({ [BY_USER(777)]: ok(samples("")) }); // an empty channel counts as missing
  r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 404);
  assert.equal(r.body.message, "No heart rate channel in samples. Available types: [3, 0]");

  stubPolar({ [BY_USER(777)]: ok(samples("0,0,0")) });
  r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 404);
  assert.deepEqual(r.body, {
    error: "no_hr",
    message: "All HR values were zero — watch may not have had a lock.",
  });
  assert.equal((await read(SESSION)).hr_samples, undefined);
});

test("values: non-numbers become null after the first beat; the channel key may be a number", async () => {
  await seed();
  await connect();
  stubPolar({
    [BY_USER(777)]: ok({
      samples: [{ "sample-type": 0, data: "0,x,65,abc,-3,70.9,", "recording-rate": 2 }],
    }),
  });
  const r = await call({ userId: UID, sessionId: SID });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, {
    ok: true,
    hr_samples: [65, null, null, 70, null],
    recording_rate_s: 2,
  });
});
