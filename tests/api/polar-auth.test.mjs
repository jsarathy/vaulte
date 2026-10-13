// tests/api/polar-auth.test.mjs — POST /api/polar-auth (Fix 120): a signed-in call gets the address
// of Polar's OAuth page, with a signed state for the person in the token.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler, { deps } from "../../api/polar-auth.js";
import { readState } from "../../api/_polar/state.js";

const NOW = 1_800_000_000_000;
deps.now = () => NOW;
deps.verify = async (token) => {
  if (!token.startsWith("tok-")) throw new Error("bad token");
  return { uid: token.slice(4) };
};

beforeEach(() => {
  process.env.POLAR_CLIENT_ID = "client-123";
  process.env.POLAR_CLIENT_SECRET = "secret-456";
  process.env.POLAR_REDIRECT_URI = "https://vaulte.example/api/polar-callback";
});
const call = async (body = {}, method = "POST", token = "tok-firebase-uid-9") => {
  const out = res();
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  await handler({ method, headers, body }, out);
  return out;
};
const stateOf = (url) => readState(new URL(url).searchParams.get("state"), "secret-456", NOW);

test("only POST; no sign-in or a bad token is a 401", async () => {
  const get = await call({}, "GET");
  assert.deepEqual([get.statusCode, get.body], [405, { error: "Method not allowed" }]);
  const anon = await call({}, "POST", null);
  assert.deepEqual([anon.statusCode, anon.body], [401, { error: "Not signed in" }]);
  const bad = await call({}, "POST", "nonsense");
  assert.deepEqual([bad.statusCode, bad.body], [401, { error: "Invalid or expired sign-in" }]);
});

test("missing Polar settings is a 500 (each of the three)", async () => {
  for (const name of ["POLAR_CLIENT_ID", "POLAR_REDIRECT_URI", "POLAR_CLIENT_SECRET"]) {
    const saved = process.env[name];
    delete process.env[name];
    const out = await call();
    assert.deepEqual(
      [out.statusCode, out.body],
      [500, { error: "Polar environment variables not configured" }],
      name,
    );
    process.env[name] = saved;
  }
});

test("the address is Polar's login page with the client, scope and a signed state for the person in the token", async () => {
  const out = await call();
  assert.equal(out.statusCode, 200);
  const url = new URL(out.body.url);
  assert.equal(url.origin + url.pathname, "https://flow.polar.com/oauth2/authorization");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://vaulte.example/api/polar-callback");
  assert.equal(url.searchParams.get("scope"), "accesslink.read_all");
  assert.deepEqual(stateOf(out.body.url), { uid: "firebase-uid-9", v: undefined });
  assert.deepEqual(Object.keys(out.body), ["url"]); // nothing else is handed out
});

test("a user id in the request is ignored: the state is for the person in the token", async () => {
  const out = await call({ userId: "someone-else", uid: "someone-else" }, "POST", "tok-me");
  assert.equal(stateOf(out.body.url).uid, "me");
});

test("v 4 is Polar's newer sign-in with its scope and a state that says v4; any other v is the old one", async () => {
  const out = await call({ v: "4" });
  const url = new URL(out.body.url);
  assert.equal(url.origin + url.pathname, "https://auth.polar.com/oauth/authorize");
  assert.equal(url.searchParams.get("scope"), "training_sessions:read");
  assert.deepEqual(stateOf(out.body.url), { uid: "firebase-uid-9", v: 4 });
  for (const v of ["3", 4, "", undefined, null]) {
    const old = new URL((await call({ v })).body.url);
    assert.equal(old.origin, "https://flow.polar.com", String(v));
    assert.equal(stateOf(old.href).v, undefined);
  }
  assert.equal(new URL((await call(undefined)).body.url).origin, "https://flow.polar.com");
});

test("each state expires ten minutes after it was made", async () => {
  const state = new URL((await call()).body.url).searchParams.get("state");
  assert.equal(readState(state, "secret-456", NOW + 10 * 60 * 1000).uid, "firebase-uid-9");
  assert.deepEqual(readState(state, "secret-456", NOW + 10 * 60 * 1000 + 1), {
    error: "state_expired",
  });
});

test("a request with no body at all is the plain sign-in", async () => {
  for (const body of [undefined, null]) {
    const out = res();
    await handler({ method: "POST", headers: { authorization: "Bearer tok-me" }, body }, out);
    assert.equal(out.statusCode, 200);
    assert.equal(new URL(out.body.url).origin, "https://flow.polar.com");
    assert.equal(stateOf(out.body.url).uid, "me");
  }
});
