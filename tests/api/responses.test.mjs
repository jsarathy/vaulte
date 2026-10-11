// tests/api/responses.test.mjs — the exact refusals, error bodies, request headers and log lines of
// the API handlers that the mutation run (Fix 81) showed no test guarded. Run by `npm run test:api`
// (Firestore emulator); Polar and Anthropic are stubbed, no network.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read, db } from "./setup.mjs";
import claude from "../../api/claude.js";
import polarAuth from "../../api/polar-auth.js";
import polarDisconnect from "../../api/polar-disconnect.js";
import polarSync from "../../api/polar-sync.js";
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

// ---- claude.js
test("claude: refuses other methods and a missing key with their messages", async () => {
  const get = res();
  await claude({ method: "GET" }, get);
  assert.deepEqual([get.statusCode, get.body], [405, { error: "Method not allowed" }]);
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const out = res();
    await claude({ method: "POST", body: {} }, out);
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
  await claude({ method: "POST", body: { model: "m", messages: [] } }, out);
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
  await claude({ method: "POST", body: {} }, out);
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
  await claude({ method: "POST", body: {} }, out);
  assert.deepEqual([out.statusCode, out.body], [500, { error: "connection reset" }]);
});

// ---- polar-auth.js
test("polar-auth: says what is missing", () => {
  process.env.POLAR_CLIENT_ID = "c";
  process.env.POLAR_REDIRECT_URI = "https://x.example/cb";
  const noUser = res();
  polarAuth({ query: {} }, noUser);
  assert.deepEqual([noUser.statusCode, noUser.body], [400, { error: "Missing userId parameter" }]);
  delete process.env.POLAR_CLIENT_ID;
  const noEnv = res();
  polarAuth({ query: { userId: "u" } }, noEnv);
  assert.deepEqual(
    [noEnv.statusCode, noEnv.body],
    [500, { error: "Polar environment variables not configured" }],
  );
});

// ---- polar-sync.js
test("polar-sync: refusals, and a failure is logged and returned", async () => {
  const get = res();
  await polarSync({ method: "GET", body: {} }, get);
  assert.deepEqual([get.statusCode, get.body], [405, { error: "Method not allowed" }]);
  const none = res();
  await polarSync({ method: "POST", body: {} }, none);
  assert.deepEqual([none.statusCode, none.body], [400, { error: "Missing userId" }]);
  const spies = silence();
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("polaraccesslink.com")) throw new Error("polar is down");
    return realFetch(url, opts);
  };
  await db()
    .doc("users/u-sync/polar/connection")
    .set({ connected: true, access_token: "t", polar_user_id: "1" });
  const out = res();
  await polarSync({ method: "POST", body: { userId: "u-sync" } }, out);
  assert.equal(out.statusCode, 500);
  assert.equal(out.body.error, "polar is down");
  assert.equal(said(spies.error)[0][0], "Polar sync error:");
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
  assert.deepEqual([none.statusCode, none.body], [400, { error: "Missing userId" }]);
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
  await polarDisconnect({ method: "POST", body: { userId: "u-dc" } }, out);
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
  assert.deepEqual(said(spies.log), [
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
  await polarDisconnect({ method: "POST", body: { userId: "u-dc2" } }, out);
  assert.deepEqual([out.statusCode, out.body], [500, { error: "polar refused" }]);
  assert.equal(said(spies.error)[0][0], "polar-disconnect error:");
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
    assert.equal(said(spies.error)[0][0], "apple-sync write failed:");
  } finally {
    process.env.APPLE_SYNC_USER_ID = "user-1";
  }
});
