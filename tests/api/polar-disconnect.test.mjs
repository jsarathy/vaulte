// tests/api/polar-disconnect.test.mjs — POST /api/polar-disconnect against the Firestore emulator.
// Polar's API is stubbed (global fetch) — no network.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import handler from "../../api/polar-disconnect.js";

const UID = "user-1",
  PATH = `users/${UID}/polar/connection`;
const realFetch = globalThis.fetch;
let calls;
const stubPolar = (impl) => {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (!String(url).includes("polaraccesslink.com")) return realFetch(url, opts); // only Polar is stubbed
    calls.push({ url: String(url), method: opts.method, headers: opts.headers });
    return impl(url, opts);
  };
};
const call = async (body) => {
  const out = res();
  await handler({ method: "POST", body }, out);
  return out;
};

beforeEach(async () => {
  await clearFirestore();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("rejects non-POST and a missing userId", async () => {
  const out = res();
  await handler({ method: "GET", body: {} }, out);
  assert.equal(out.statusCode, 405);
  assert.equal((await call({})).statusCode, 400);
});

test("not connected: just records connected:false, no Polar calls", async () => {
  stubPolar(async () => {
    throw new Error("should not be called");
  });
  const out = await call({ userId: UID });
  assert.deepEqual(out.body, { ok: true, action: "cleared" });
  assert.deepEqual(await read(PATH), { connected: false });
  assert.equal(calls.length, 0);
});

test("connected: deregisters + re-registers with Polar, then clears the token", async () => {
  await db().doc(PATH).set({ connected: true, access_token: "tok-abc", polar_user_id: 9876 });
  stubPolar(async (url, opts) => ({ status: opts.method === "DELETE" ? 204 : 200 }));
  const out = await call({ userId: UID });
  assert.equal(
    out.body.action,
    "deregistered_and_reregistered",
    `handler replied ${out.statusCode} ${JSON.stringify(out.body)}`,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "DELETE");
  assert.match(calls[0].url, /\/v3\/users\/9876$/);
  assert.equal(calls[0].headers.Authorization, "Bearer tok-abc");
  assert.equal(calls[1].method, "POST");
  assert.match(calls[1].url, /\/v3\/users$/);
  const d = await read(PATH);
  assert.equal(d.connected, false);
  assert.equal(d.access_token, null);
  assert.ok(d.disconnected_at);
  assert.equal(d.polar_user_id, 9876); // kept for the next auth
});

test("Polar unreachable: 500, but still marked disconnected", async () => {
  await db().doc(PATH).set({ connected: true, access_token: "tok-abc", polar_user_id: 9876 });
  stubPolar(async () => {
    throw new Error("network down");
  });
  const out = await call({ userId: UID });
  assert.equal(out.statusCode, 500);
  const d = await read(PATH);
  assert.equal(d.connected, false);
  assert.equal(d.access_token, null);
});
