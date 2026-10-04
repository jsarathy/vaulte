// tests/api/polar-auth.test.mjs — GET /api/polar-auth (redirect to Polar's OAuth page)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler from "../../api/polar-auth.js";

beforeEach(() => {
  process.env.POLAR_CLIENT_ID = "client-123";
  process.env.POLAR_REDIRECT_URI = "https://vaulte.example/api/polar-callback";
});
const call = (query) => {
  const out = res();
  handler({ query }, out);
  return out;
};

test("missing userId is a 400", () => {
  assert.equal(call({}).statusCode, 400);
});

test("missing Polar settings is a 500", () => {
  delete process.env.POLAR_CLIENT_ID;
  assert.equal(call({ userId: "u1" }).statusCode, 500);
  process.env.POLAR_CLIENT_ID = "client-123";
  delete process.env.POLAR_REDIRECT_URI;
  assert.equal(call({ userId: "u1" }).statusCode, 500);
});

test("redirects to Polar with the client, scope and the user id in state", () => {
  const out = call({ userId: "firebase-uid-9" });
  assert.equal(out.statusCode, 302);
  const url = new URL(out.location);
  assert.equal(url.origin + url.pathname, "https://flow.polar.com/oauth2/authorization");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://vaulte.example/api/polar-callback");
  assert.equal(url.searchParams.get("scope"), "accesslink.read_all");
  const state = JSON.parse(Buffer.from(url.searchParams.get("state"), "base64url").toString());
  assert.deepEqual(state, { uid: "firebase-uid-9" });
});
