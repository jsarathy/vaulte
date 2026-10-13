// tests/api/polar-callback.test.mjs — GET /api/polar-callback against the Firestore emulator.
// Polar's token and AccessLink endpoints are stubbed — no network.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read } from "./setup.mjs";
import handler from "../../api/polar-callback.js";
import { signState } from "../../api/_polar/state.js";

const APP = "https://vaulte.example";
const UID = "user-1";
const PATH = `users/${UID}/polar/connection`;
const SECRET = "secret-456";
// A state the server would have made for this user a moment ago.
const state = signState({ uid: UID }, SECRET, Date.now());
const realFetch = globalThis.fetch;
let calls;

function stubPolar({ token = { ok: true }, register = 200, fail = false } = {}) {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.includes("polarremote.com") && !u.includes("polaraccesslink.com"))
      return realFetch(url, opts);
    calls.push({ url: u, opts });
    if (fail) throw new Error("network down");
    if (u.includes("polarremote.com"))
      return token.ok
        ? { ok: true, json: async () => ({ access_token: "tok-new", x_user_id: 4242 }) }
        : { ok: false, text: async () => "invalid_grant" };
    return { ok: register === 200, status: register, text: async () => "body" };
  };
}
const call = async (query) => {
  const out = res();
  await handler({ query }, out);
  return out;
};

beforeEach(async () => {
  await clearFirestore();
  process.env.VAULTE_APP_URL = APP;
  process.env.POLAR_CLIENT_ID = "client-123";
  process.env.POLAR_CLIENT_SECRET = "secret-456";
  process.env.POLAR_REDIRECT_URI = `${APP}/api/polar-callback`;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("user denied, missing params and a bad state redirect back with the reason", async () => {
  stubPolar();
  assert.equal((await call({ error: "access_denied" })).location, `${APP}/?polar=denied`);
  assert.equal((await call({ code: "c" })).location, `${APP}/?polar=error&reason=missing_params`);
  assert.equal(
    (await call({ code: "c", state: "not-base64-json" })).location,
    `${APP}/?polar=error&reason=bad_state`,
  );
  assert.equal(calls.length, 0);
});

test("exchanges the code, registers with AccessLink and saves the connection", async () => {
  stubPolar();
  const out = await call({ code: "auth-code", state });
  assert.equal(out.statusCode, 302);
  assert.equal(out.location, `${APP}/?polar=connected`);
  const [tokenCall, regCall] = calls;
  assert.match(tokenCall.url, /polarremote\.com\/v2\/oauth2\/token$/);
  assert.equal(
    tokenCall.opts.headers.Authorization,
    "Basic " + Buffer.from("client-123:secret-456").toString("base64"),
  );
  const form = new URLSearchParams(tokenCall.opts.body);
  assert.equal(form.get("grant_type"), "authorization_code");
  assert.equal(form.get("code"), "auth-code");
  assert.match(regCall.url, /polaraccesslink\.com\/v3\/users$/);
  assert.equal(regCall.opts.headers.Authorization, "Bearer tok-new");
  assert.deepEqual(JSON.parse(regCall.opts.body), { "member-id": UID });
  const d = await read(PATH);
  assert.equal(d.connected, true);
  assert.equal(d.access_token, "tok-new");
  assert.equal(d.polar_user_id, "4242");
  assert.equal(d.last_sync_at, null);
  assert.ok(d.connected_at);
});

test("already registered (409) or a registration error still connects", async () => {
  for (const register of [409, 500]) {
    await clearFirestore();
    stubPolar({ register });
    assert.equal((await call({ code: "c", state })).location, `${APP}/?polar=connected`);
    assert.equal((await read(PATH)).connected, true);
  }
});

test("failed token exchange or network error: error redirect, nothing saved", async () => {
  stubPolar({ token: { ok: false } });
  assert.equal(
    (await call({ code: "c", state })).location,
    `${APP}/?polar=error&reason=token_exchange`,
  );
  assert.equal(await read(PATH), undefined);
  stubPolar({ fail: true });
  assert.equal(
    (await call({ code: "c", state })).location,
    `${APP}/?polar=error&reason=server_error`,
  );
  assert.equal(await read(PATH), undefined);
});

// Fix 81 ---------------------------------------------------------------------------------

const quiet = () => ({
  log: mock.method(console, "log", () => {}),
  warn: mock.method(console, "warn", () => {}),
  error: mock.method(console, "error", () => {}),
});
const said = (spy) => spy.mock.calls.map((c) => c.arguments);
// Look a log line up by its label: other code (the Google auth library on CI) logs too.
const logged = (spy, label) => said(spy).filter((a) => a[0] === label);

test("the requests to Polar are POSTs with their content types and Accept headers", async () => {
  quiet();
  stubPolar();
  await call({ code: "c", state });
  const [tokenCall, regCall] = calls;
  assert.equal(tokenCall.opts.method, "POST");
  assert.equal(tokenCall.opts.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(tokenCall.opts.headers.Accept, "application/json");
  assert.equal(
    new URLSearchParams(tokenCall.opts.body).get("redirect_uri"),
    `${APP}/api/polar-callback`,
  );
  assert.equal(regCall.opts.method, "POST");
  assert.equal(regCall.opts.headers["Content-Type"], "application/json");
  assert.equal(regCall.opts.headers.Accept, "application/json");
  mock.restoreAll();
});

test("a registration that is neither OK nor 'already registered' is warned about; the others are not", async () => {
  for (const [register, warned] of [
    [200, false],
    [409, false],
    [500, true],
  ]) {
    await clearFirestore();
    const spies = quiet();
    stubPolar({ register });
    await call({ code: "c", state });
    assert.deepEqual(logged(spies.log, "Polar registration status:")[0], [
      "Polar registration status:",
      register,
    ]);
    assert.equal(
      logged(spies.warn, "Polar registration non-fatal error:").length,
      warned ? 1 : 0,
      `status ${register}`,
    );
    if (warned)
      assert.deepEqual(logged(spies.warn, "Polar registration non-fatal error:")[0], [
        "Polar registration non-fatal error:",
        500,
        "body",
      ]);
    mock.restoreAll();
  }
});

test("a refused token and a crash are logged with what Polar or the error said", async () => {
  const spies = quiet();
  stubPolar({ token: { ok: false } });
  await call({ code: "c", state });
  assert.deepEqual(logged(spies.error, "Token exchange failed:")[0], [
    "Token exchange failed:",
    "invalid_grant",
  ]);
  stubPolar({ fail: true });
  await call({ code: "c", state });
  const [label, err] = logged(spies.error, "Polar callback error:")[0];
  assert.equal(label, "Polar callback error:");
  assert.match(err.message, /network down/);
  mock.restoreAll();
});

test("without VAULTE_APP_URL the redirect goes to the live app", async () => {
  delete process.env.VAULTE_APP_URL;
  try {
    stubPolar();
    assert.equal(
      (await call({ error: "access_denied" })).location,
      "https://vaulte-roan.vercel.app/?polar=denied",
    );
  } finally {
    process.env.VAULTE_APP_URL = APP;
  }
});

test("a state that was not signed by the server, or was changed, is refused with bad_state and nothing is saved", async () => {
  stubPolar();
  const forged = Buffer.from(JSON.stringify({ uid: "victim" })).toString("base64url"); // the old unsigned form
  const other = signState({ uid: "victim" }, "someone-elses-secret", Date.now());
  const real = signState({ uid: UID }, SECRET, Date.now());
  const body = Buffer.from(JSON.stringify({ uid: "victim", exp: Date.now() + 60000 })).toString(
    "base64url",
  );
  const swapped = `${body}.${real.split(".")[1]}`;
  for (const bad of [forged, other, swapped, `${real}.extra`]) {
    const out = await call({ code: "c", state: bad });
    assert.equal(out.location, `${APP}/?polar=error&reason=bad_state`);
  }
  assert.equal(calls.length, 0); // Polar was not even asked
  assert.equal(await read("users/victim/polar/connection"), undefined);
  assert.equal(await read(PATH), undefined);
});

test("an expired state is refused with state_expired", async () => {
  stubPolar();
  const old = signState({ uid: UID }, SECRET, Date.now() - 11 * 60 * 1000);
  const out = await call({ code: "c", state: old });
  assert.equal(out.location, `${APP}/?polar=error&reason=state_expired`);
  assert.equal(calls.length, 0);
  assert.equal(await read(PATH), undefined);
});

test("with no Polar secret configured no state is accepted", async () => {
  stubPolar();
  const good = signState({ uid: UID }, SECRET, Date.now());
  delete process.env.POLAR_CLIENT_SECRET;
  const out = await call({ code: "c", state: good });
  assert.equal(out.location, `${APP}/?polar=error&reason=bad_state`);
  const forged = signState({ uid: UID }, "undefined", Date.now()); // what an unset variable would stringify to
  const again = await call({ code: "c", state: forged });
  assert.equal(again.location, `${APP}/?polar=error&reason=bad_state`);
});
