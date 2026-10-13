// tests/api/responses.test.mjs — the exact refusals, error bodies, request headers and log lines of
// the API handlers that the mutation run (Fix 81) showed no test guarded. Run by `npm run test:api`
// (Firestore emulator); Polar and Anthropic are stubbed, no network.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import claude, { deps as claudeDeps } from "../../api/claude.js";
import polarAuth from "../../api/polar-auth.js";
import polarDisconnect, { deps as disconnectDeps } from "../../api/polar-disconnect.js";
import polarSync, { deps as syncDeps } from "../../api/polar-sync.js";
import appleSync from "../../api/apple-sync.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restoreAll();
});
beforeEach(clearFirestore);

const silence = () => ({
  log: mock.method(console, "log", () => {}),
  error: mock.method(console, "error", () => {}),
});
const said = (spy) => spy.mock.calls.map((c) => c.arguments);
// Look a log line up by its label: other code (the Google auth library on CI) logs too.
const logged = (spy, label) => said(spy).filter((a) => a[0] === label);

// ---- claude.js
claudeDeps.verify = async () => ({ uid: "u1", email_verified: true }); // signed in (the token check has its own tests)
const SIGNED_IN = { authorization: "Bearer good" };
test("claude: refuses other methods and a missing key with their messages", async () => {
  const get = res();
  await claude({ method: "GET" }, get);
  assert.deepEqual([get.statusCode, get.body], [405, { error: "Method not allowed" }]);
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const out = res();
    await claude({ method: "POST", headers: SIGNED_IN, body: {} }, out);
    assert.deepEqual(
      [out.statusCode, out.body],
      [500, { error: "ANTHROPIC_API_KEY not configured" }],
    );
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("claude: forwards the body to Anthropic with the key and version, and relays the status", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return { status: 429, json: async () => ({ error: "slow down", content: "text" }) };
  };
  const out = res();
  await claude({ method: "POST", headers: SIGNED_IN, body: { model: "m", messages: [] } }, out);
  assert.equal(seen.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen.opts.method, "POST");
  assert.deepEqual(seen.opts.headers, {
    "Content-Type": "application/json",
    "x-api-key": "sk-test",
    "anthropic-version": "2023-06-01",
  });
  assert.deepEqual(JSON.parse(seen.opts.body), { model: "m", messages: [] });
  assert.deepEqual([out.statusCode, out.body.error], [429, "slow down"]);
  assert.equal(out.body.content, "text"); // content that is not a list is passed on as it is
});

test("claude: only web-search results lose their encrypted blobs", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  const content = [
    { type: "web_search_tool_result", content: [{ url: "u", encrypted_content: "blob" }] },
    { type: "web_search_tool_result", content: "an error text" },
    { type: "text", content: [{ url: "u", encrypted_content: "keep" }] },
  ];
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ content }) });
  const out = res();
  await claude({ method: "POST", headers: SIGNED_IN, body: {} }, out);
  assert.deepEqual(out.body.content, [
    { type: "web_search_tool_result", content: [{ url: "u" }] },
    { type: "web_search_tool_result", content: "an error text" },
    { type: "text", content: [{ url: "u", encrypted_content: "keep" }] },
  ]);
});

test("claude: a failed call to Anthropic is a 500 with the error text", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test";
  globalThis.fetch = async () => {
    throw new Error("connection reset");
  };
  const out = res();
  await claude({ method: "POST", headers: SIGNED_IN, body: {} }, out);
  assert.deepEqual([out.statusCode, out.body], [500, { error: "connection reset" }]);
});

// ---- polar-auth.js (the full tests are in polar-auth.test.mjs)
test("polar-auth: only POST", async () => {
  const out = res();
  await polarAuth({ method: "GET" }, out);
  assert.deepEqual([out.statusCode, out.body], [405, { error: "Method not allowed" }]);
});

// The Polar functions take the user from the ID token; here the token is the user id itself.
syncDeps.verify = disconnectDeps.verify = async (token) => ({ uid: token });
const AS = (uid) => ({ authorization: `Bearer ${uid}` });

// ---- polar-sync.js
test("polar-sync: refusals, and a failure is logged and returned", async () => {
  const get = res();
  await polarSync({ method: "GET", body: {} }, get);
  assert.deepEqual([get.statusCode, get.body], [405, { error: "Method not allowed" }]);
  const none = res();
  await polarSync({ method: "POST", body: {} }, none);
  assert.deepEqual([none.statusCode, none.body], [401, { error: "Not signed in" }]);
  const spies = silence();
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("polaraccesslink.com")) throw new Error("polar is down");
    return realFetch(url, opts);
  };
  await db()
    .doc("users/u-sync/polar/connection")
    .set({ connected: true, access_token: "t", polar_user_id: "1" });
  const out = res();
  await polarSync({ method: "POST", headers: AS("u-sync"), body: {} }, out);
  assert.equal(out.statusCode, 500);
  assert.equal(out.body.error, "polar is down");
  assert.equal(logged(spies.error, "Polar sync error:").length, 1);
});

// ---- polar-disconnect.js
const connected = (uid) =>
  db()
    .doc(`users/${uid}/polar/connection`)
    .set({ connected: true, access_token: "tok-1", polar_user_id: "777" });

test("polar-disconnect: refusals and their messages", async () => {
  const get = res();
  await polarDisconnect({ method: "GET", body: {} }, get);
  assert.deepEqual([get.statusCode, get.body], [405, { error: "Method not allowed" }]);
  const none = res();
  await polarDisconnect({ method: "POST", body: {} }, none);
  assert.deepEqual([none.statusCode, none.body], [401, { error: "Not signed in" }]);
});

test("polar-disconnect: deletes then re-registers with the right headers, waiting in between, and logs both", async () => {
  const spies = silence();
  await connected("u-dc");
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (!String(url).includes("polaraccesslink.com")) return realFetch(url, opts);
    calls.push({ at: Date.now(), url: String(url), opts });
    return { status: opts.method === "DELETE" ? 204 : 200, ok: true, text: async () => "" };
  };
  const out = res();
  await polarDisconnect({ method: "POST", headers: AS("u-dc"), body: {} }, out);
  assert.deepEqual(out.body, { ok: true, action: "deregistered_and_reregistered" });
  const [del, reg] = calls;
  assert.deepEqual(del.opts.headers, { Authorization: "Bearer tok-1", Accept: "application/json" });
  assert.equal(del.opts.method, "DELETE");
  assert.match(del.url, /\/v3\/users\/777$/);
  assert.deepEqual(reg.opts.headers, {
    Authorization: "Bearer tok-1",
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  assert.equal(reg.opts.method, "POST");
  assert.deepEqual(JSON.parse(reg.opts.body), { "member-id": "u-dc" });
  assert.ok(reg.at - del.at >= 450, "Polar is given time to process the deletion");
  const polarLogs = said(spies.log).filter((a) => String(a[0]).startsWith("Polar "));
  assert.deepEqual(polarLogs, [
    ["Polar DELETE /v3/users status:", 204],
    ["Polar re-register status:", 200],
  ]);
  const after = await read("users/u-dc/polar/connection");
  assert.equal(after.connected, false);
  assert.equal(after.access_token, null);
});

test("polar-disconnect: when Polar fails the connection is still cleared and the error is returned", async () => {
  const spies = silence();
  await connected("u-dc2");
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("polaraccesslink.com")) throw new Error("polar refused");
    return realFetch(url, opts);
  };
  const out = res();
  await polarDisconnect({ method: "POST", headers: AS("u-dc2"), body: {} }, out);
  assert.deepEqual([out.statusCode, out.body], [500, { error: "polar refused" }]);
  assert.equal(logged(spies.error, "polar-disconnect error:").length, 1);
  assert.equal((await read("users/u-dc2/polar/connection")).connected, false);
});

// ---- apple-sync.js
process.env.APPLE_SYNC_TOKEN = "test-token-123";
process.env.APPLE_SYNC_USER_ID = "user-1";
const apple = async (body) => {
  const out = res();
  await appleSync(
    { method: "POST", headers: { authorization: "Bearer test-token-123" }, body },
    out,
  );
  return out;
};

test("apple-sync: text that is not JSON and a date that cannot be read are 400s with their messages", async () => {
  const bad = await apple("{not json");
  assert.deepEqual([bad.statusCode, bad.body], [400, { error: "Invalid JSON" }]);
  const date = await apple({ date: "next tuesday", steps: 5 });
  assert.deepEqual(
    [date.statusCode, date.body],
    [400, { error: "Unrecognised date: next tuesday" }],
  );
});

test("apple-sync: a write that fails is logged and answered with a 500", async () => {
  const spies = silence();
  process.env.APPLE_SYNC_USER_ID = "odd/path";
  try {
    const out = await apple({ date: "2026-10-01", steps: 5 });
    assert.deepEqual([out.statusCode, out.body], [500, { error: "Firestore write failed" }]);
    assert.equal(logged(spies.error, "apple-sync write failed:").length, 1);
  } finally {
    process.env.APPLE_SYNC_USER_ID = "user-1";
  }
});
