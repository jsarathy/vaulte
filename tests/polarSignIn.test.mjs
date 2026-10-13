// tests/polarSignIn.test.mjs — starting Polar's sign-in (Fix 120): a signed-in call for the address,
// then the browser goes there; any failure is an alert and the browser stays.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { signInToPolar } from "../src/api/polarSignIn.js";
import { setTokenSource } from "../src/api/authToken.js";

const realFetch = globalThis.fetch;
let asked;
let alerts;
const reply = (status, body) => async (url, opts) => {
  asked.push({ url, opts });
  return { ok: status < 300, status, json: async () => body };
};
beforeEach(() => {
  asked = [];
  alerts = [];
  globalThis.window = { location: { href: "/addentry" } };
  globalThis.alert = (m) => alerts.push(m);
  setTokenSource(async () => "id-tok");
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.window;
  delete globalThis.alert;
  setTokenSource(null);
});

test("asks the server with the ID token and goes to the address it gives; v 4 is sent when asked for", async () => {
  globalThis.fetch = reply(200, { url: "https://flow.polar.com/oauth2/authorization?state=S" });
  await signInToPolar();
  assert.equal(
    globalThis.window.location.href,
    "https://flow.polar.com/oauth2/authorization?state=S",
  );
  assert.equal(asked[0].url, "/api/polar-auth");
  assert.equal(asked[0].opts.method, "POST");
  assert.deepEqual(asked[0].opts.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer id-tok",
  });
  assert.equal(asked[0].opts.body, "{}");
  assert.deepEqual(alerts, []);
  await signInToPolar("4");
  assert.equal(asked[1].opts.body, JSON.stringify({ v: "4" }));
});

test("a refusal, a reply that is not JSON, one with no address and a network failure each alert and stay", async () => {
  globalThis.fetch = reply(401, { error: "Not signed in" });
  await signInToPolar();
  globalThis.fetch = async () => ({
    ok: false,
    status: 502,
    json: async () => Promise.reject(new Error("x")),
  });
  await signInToPolar();
  globalThis.fetch = reply(200, {});
  await signInToPolar();
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  await signInToPolar();
  assert.deepEqual(alerts, [
    "Could not start the Polar sign-in: Not signed in",
    "Could not start the Polar sign-in: Request failed (502)",
    "Could not start the Polar sign-in: Request failed (200)",
    "Could not start the Polar sign-in: offline",
  ]);
  assert.equal(globalThis.window.location.href, "/addentry");
});

test("with nobody signed in no token is sent (the server then says 401)", async () => {
  setTokenSource(null);
  globalThis.fetch = reply(401, { error: "Not signed in" });
  await signInToPolar();
  assert.deepEqual(asked[0].opts.headers, { "Content-Type": "application/json" });
});
