// tests/api/polar-callback.test.mjs — GET /api/polar-callback against the Firestore emulator.
// Polar's token and AccessLink endpoints are stubbed — no network.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read } from "./setup.mjs";
import handler from "../../api/polar-callback.js";

const APP = "https://vaulte.example";
const UID = "user-1";
const PATH = `users/${UID}/polar/connection`;
const state = Buffer.from(JSON.stringify({ uid: UID })).toString("base64url");
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
