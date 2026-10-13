// tests/api/polar-v4.test.mjs — Polar's newer API (v4) through the three functions that use it:
// polar-auth (the sign-in), polar-callback (the tokens) and polar-fetch-hr (a past session's heart
// rate), against the Firestore emulator. Polar is stubbed (global fetch) — no network.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import auth from "../../api/polar-auth.js";
import callback from "../../api/polar-callback.js";
import fetchHr, { deps } from "../../api/polar-fetch-hr.js";

// A good token for any user: "tok-<uid>".
deps.verify = async (token) => ({ uid: token.slice(4) });

const APP = "https://vaulte.example";
const UID = "user-1";
const SID = "ex-11";
const V3_CONN = `users/${UID}/polar/connection`;
const V4_CONN = `users/${UID}/polar/connection_v4`;
const SESSION = `users/${UID}/polar_sessions/${SID}`;
const LIST = "https://www.polaraccesslink.com/v4/data/training-sessions/list?from=";
const TOKEN = "https://auth.polar.com/oauth/token";
const DAY = 86400000;
const realFetch = globalThis.fetch;
let calls;

/** Serve Polar from a { [url prefix]: { status, json?, text? } } map; unlisted Polar URLs fail. */
const stubPolar = (routes) => {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes("polaraccesslink.com") && !u.includes("auth.polar.com"))
      return realFetch(url, opts);
    calls.push({ url: u, opts });
    const key = Object.keys(routes).find((k) => u.startsWith(k));
    const r = routes[key] ?? { status: 404, text: "not stubbed" };
    return {
      ok: r.status < 300,
      status: r.status,
      text: async () => r.text ?? JSON.stringify(r.json ?? ""),
      json: async () => r.json,
    };
  };
};
const state = (extra) => Buffer.from(JSON.stringify({ uid: UID, ...extra })).toString("base64url");
const call = async (handler, req) => {
  const out = res();
  await handler(req, out);
  return out;
};
const fetchFor = (body = { sessionId: SID }) =>
  call(fetchHr, { method: "POST", headers: { authorization: `Bearer tok-${UID}` }, body });
const seedSession = (fields = {}) =>
  db()
    .doc(SESSION)
    .set({
      sport: "CYCLING",
      start_time: "2026-09-25T10:42:00",
      fetched_at: new Date(Date.now() - 40 * DAY).toISOString(),
      polar_user_id: 777,
      ...fields,
    });
const connectV3 = () =>
  db().doc(V3_CONN).set({ connected: true, access_token: "tok-v3", polar_user_id: 777 });
const connectV4 = (extra = {}) =>
  db()
    .doc(V4_CONN)
    .set({
      access_token: "tok-v4",
      refresh_token: "ref-1",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      ...extra,
    });
const hit = (values) => ({
  startTime: "2026-09-25T07:42:00Z",
  timezoneOffsetMinutes: 180,
  exercises: [{ samples: { samples: [{ type: "HEART_RATE", intervalMillis: 1000, values }] } }],
});

beforeEach(async () => {
  await clearFirestore();
  process.env.VAULTE_APP_URL = APP;
  process.env.POLAR_CLIENT_ID = "client-123";
  process.env.POLAR_CLIENT_SECRET = "secret-456";
  process.env.POLAR_REDIRECT_URI = `${APP}/api/polar-callback`;
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
  mock.method(console, "warn", () => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restoreAll();
});

test("polar-auth with v=4 goes to Polar's v4 sign-in with the new scope; the state says v4", async () => {
  const out = await call(auth, { query: { userId: UID, v: "4" } });
  assert.equal(out.statusCode, 302);
  const url = new URL(out.location);
  assert.equal(url.origin + url.pathname, "https://auth.polar.com/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), `${APP}/api/polar-callback`);
  assert.equal(url.searchParams.get("scope"), "training_sessions:read");
  const sent = JSON.parse(Buffer.from(url.searchParams.get("state"), "base64url").toString());
  assert.deepEqual(sent, { uid: UID, v: 4 });
  // any other v (or none) is the existing v3 sign-in
  const old = new URL((await call(auth, { query: { userId: UID, v: "3" } })).location);
  assert.equal(old.origin, "https://flow.polar.com");
});

test("polar-callback with a v4 state exchanges the code at Polar's v4 token page and stores the tokens apart from v3", async () => {
  await connectV3();
  stubPolar({
    [TOKEN]: { status: 200, json: { access_token: "a4", refresh_token: "r4", expires_in: 3600 } },
  });
  const out = await call(callback, { query: { code: "C", state: state({ v: 4 }) } });
  assert.equal(out.location, `${APP}/?polar=v4connected`);
  assert.equal(calls.length, 1); // no AccessLink registration for v4
  const form = new URLSearchParams(calls[0].opts.body);
  assert.equal(form.get("grant_type"), "authorization_code");
  assert.equal(form.get("code"), "C");
  assert.equal(form.get("redirect_uri"), `${APP}/api/polar-callback`);
  const d = await read(V4_CONN);
  assert.equal(d.access_token, "a4");
  assert.equal(d.refresh_token, "r4");
  assert.equal(d.scope, "training_sessions:read");
  assert.ok(d.connected_at && d.expires_at);
  assert.equal((await read(V3_CONN)).access_token, "tok-v3"); // v3 untouched
});

test("polar-callback v4: a refused token exchange redirects with v4token and stores nothing", async () => {
  stubPolar({ [TOKEN]: { status: 400, text: "invalid_client" } });
  const out = await call(callback, { query: { code: "C", state: state({ v: 4 }) } });
  assert.equal(out.location, `${APP}/?polar=v4token`);
  assert.equal(await read(V4_CONN), undefined);
  const logged = console.error.mock.calls.map((c) => c.arguments);
  assert.deepEqual(logged, [["Polar v4 token exchange failed:", 400, "invalid_client"]]);
});

test("polar-callback: a state without v is still the v3 sign-in", async () => {
  stubPolar({ "https://polarremote.com": { status: 400, text: "no" } });
  const out = await call(callback, { query: { code: "C", state: state({}) } });
  assert.equal(out.location, `${APP}/?polar=error&reason=token_exchange`);
});

test("polar-fetch-hr: v3 has nothing, v4 is signed in: the heart rate is stored from v4, with the attempts", async () => {
  await seedSession();
  await connectV3();
  await connectV4();
  stubPolar({
    [LIST + "2026-09-25"]: { status: 200, json: { trainingSessions: [hit([0, 90, 0, 95])] } },
  });
  const out = await fetchFor();
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body, { ok: true, hr_samples: [90, null, 95], recording_rate_s: 1 });
  const s = await read(SESSION);
  assert.deepEqual(s.hr_samples, [90, null, 95]);
  assert.equal(s.sport, "CYCLING");
  const v4 = calls.find((c) => c.url.startsWith(LIST));
  assert.equal(v4.opts.headers.Authorization, "Bearer tok-v4");
});

test("polar-fetch-hr: v3 is tried first; when it already has the heart rate v4 is not called", async () => {
  await seedSession({
    exercise_url:
      "https://www.polaraccesslink.com/v3/users/777/exercise-transactions/1/exercises/x",
  });
  await connectV3();
  await connectV4();
  stubPolar({
    "https://www.polaraccesslink.com/v3/users/777/exercises/": {
      status: 200,
      json: { samples: [{ "sample-type": "0", data: "80,82", "recording-rate": 1 }] },
    },
  });
  const out = await fetchFor();
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body.hr_samples, [80, 82]);
  assert.equal(
    calls.some((c) => c.url.includes("/v4/")),
    false,
  );
});

test("polar-fetch-hr: an expired v4 token is refreshed and the new tokens are stored", async () => {
  await seedSession();
  await connectV3();
  await connectV4({ expires_at: new Date(Date.now() - 1000).toISOString() });
  stubPolar({
    [TOKEN]: { status: 200, json: { access_token: "fresh", expires_in: 3600 } },
    [LIST + "2026-09-25"]: { status: 200, json: { trainingSessions: [hit([88])] } },
  });
  const out = await fetchFor();
  assert.equal(out.statusCode, 200);
  const d = await read(V4_CONN);
  assert.equal(d.access_token, "fresh");
  assert.equal(d.refresh_token, "ref-1"); // kept: Polar sent no new one
  const list = calls.find((c) => c.url.startsWith(LIST));
  assert.equal(list.opts.headers.Authorization, "Bearer fresh");
});

test("polar-fetch-hr: a v4 refresh that fails still stores nothing new and reports samples_unavailable", async () => {
  await seedSession();
  await connectV3();
  await connectV4({ expires_at: new Date(Date.now() - 1000).toISOString() });
  stubPolar({ [TOKEN]: { status: 400, text: "invalid_grant" } });
  const out = await fetchFor();
  assert.equal(out.statusCode, 502);
  assert.equal(out.body.error, "samples_unavailable");
  const last = out.body.attempts.at(-1);
  assert.deepEqual(last, {
    url: "token refresh",
    auth: "v4",
    status: 400,
    ok: false,
    detail: "invalid_grant",
  });
  assert.equal((await read(V4_CONN)).access_token, "tok-v4");
});

test("polar-fetch-hr: signed in to v4 but the day holds no such session: samples_unavailable, not too_old", async () => {
  await seedSession();
  await connectV3();
  await connectV4();
  stubPolar({ [LIST]: { status: 200, json: { trainingSessions: [] } } });
  const out = await fetchFor();
  assert.equal(out.statusCode, 502);
  assert.equal(out.body.error, "samples_unavailable");
  const v4 = out.body.attempts.filter((a) => a.auth === "v4");
  assert.equal(v4.length, 3); // the day, the day before and the day after
  assert.deepEqual(
    v4.map((a) => a.matched),
    [false, false, false],
  );
});

test("polar-fetch-hr: not signed in to v4, and older than 30 days: still too_old", async () => {
  await seedSession();
  await connectV3();
  stubPolar({});
  const out = await fetchFor();
  assert.equal(out.statusCode, 404);
  assert.equal(out.body.error, "too_old");
  assert.equal(
    calls.some((c) => c.url.includes("/v4/")),
    false,
  );
});

test("polar-fetch-hr: a v4 connection document without a token counts as not signed in", async () => {
  await seedSession({ fetched_at: new Date().toISOString() });
  await connectV3();
  await db().doc(V4_CONN).set({ scope: "x" });
  stubPolar({});
  const out = await fetchFor();
  assert.equal(out.body.error, "samples_unavailable");
  assert.equal(
    out.body.attempts.some((a) => a.auth === "v4"),
    false,
  ); // v4 was not tried at all
  assert.equal(
    calls.some((c) => c.url.includes("/v4/")),
    false,
  );
});
