// tests/api/claude-proxy.test.mjs — /api/claude proxy (no Firestore). Anthropic API stubbed.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler, { deps } from "../../api/claude.js";
import { verifyIdToken } from "../../api/_admin/verify.js";

const realVerify = deps.verify; // what the proxy checks tokens with, before the tests stand in for it

// The token check stands in for Google's keys: "tok-<uid>" is a good token for that user.
deps.verify = async (token) => {
  if (!token.startsWith("tok-")) throw new Error("bad token");
  return { uid: token.slice(4), email_verified: true };
};
const AS = (uid) => ({ authorization: `Bearer tok-${uid}` });

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
});
process.env.ANTHROPIC_API_KEY = "test-key";

test("rejects non-POST; missing API key is a 500", async () => {
  let out = res();
  await handler({ method: "GET" }, out);
  assert.equal(out.statusCode, 405);
  delete process.env.ANTHROPIC_API_KEY;
  out = res();
  await handler({ method: "POST", headers: AS("u1"), body: {} }, out);
  assert.equal(out.statusCode, 500);
});

test("forwards the body with the key and passes the status through", async () => {
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return { status: 429, json: async () => ({ error: { type: "rate_limit" } }) };
  };
  const out = res();
  await handler({ method: "POST", headers: AS("u1"), body: { model: "m", messages: [] } }, out);
  assert.equal(seen.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen.opts.headers["x-api-key"], "test-key");
  assert.deepEqual(JSON.parse(seen.opts.body), { model: "m", messages: [] });
  assert.equal(out.statusCode, 429);
});

test("strips web-search encrypted_content (keeps responses under Vercel's size limit)", async () => {
  globalThis.fetch = async () => ({
    status: 200,
    json: async () => ({
      content: [
        {
          type: "web_search_tool_result",
          content: [{ url: "u1", title: "t1", encrypted_content: "x".repeat(10000) }],
        },
        { type: "text", text: "answer" },
      ],
    }),
  });
  const out = res();
  await handler({ method: "POST", headers: AS("u1"), body: {} }, out);
  assert.deepEqual(out.body.content[0].content, [{ url: "u1", title: "t1" }]);
  assert.equal(out.body.content[1].text, "answer");
});

test("a request with no sign-in, a malformed header or a bad token is a 401 and never reaches Anthropic", async () => {
  let reached = false;
  globalThis.fetch = async () => {
    reached = true;
    return { status: 200, json: async () => ({}) };
  };
  const body = { model: "m", messages: [] };
  const cases = [
    [{ method: "POST", body }, "Not signed in"],
    [{ method: "POST", headers: {}, body }, "Not signed in"],
    [{ method: "POST", headers: { authorization: "" }, body }, "Not signed in"],
    [{ method: "POST", headers: { authorization: "Bearer " }, body }, "Not signed in"],
    [
      { method: "POST", headers: { authorization: "Bearer nonsense" }, body },
      "Invalid or expired sign-in",
    ],
    [
      { method: "POST", headers: { authorization: "Basic tok-u1" }, body },
      "Invalid or expired sign-in",
    ],
  ];
  for (const [req, message] of cases) {
    const out = res();
    await handler(req, out);
    assert.equal(out.statusCode, 401, message);
    assert.deepEqual(out.body, { error: message });
  }
  assert.equal(reached, false);
});

test("the sign-in is checked before the API key: no key and no token is a 401, not a 500", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = res();
  await handler({ method: "POST", body: {} }, out);
  assert.equal(out.statusCode, 401);
});

test("the Bearer word is case-insensitive and the token is what is verified", async () => {
  const seen = [];
  deps.verify = async (t) => {
    seen.push(t);
    return { uid: "u9", email_verified: true };
  };
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ content: [] }) });
  const out = res();
  await handler(
    { method: "POST", headers: { authorization: "bearer   abc.def.ghi" }, body: {} },
    out,
  );
  assert.equal(out.statusCode, 200);
  assert.deepEqual(seen, ["abc.def.ghi"]);
});

test("the proxy checks tokens with the real verifyIdToken (Google's keys), not a stand-in", () => {
  assert.equal(realVerify, verifyIdToken);
});

test("a person whose email address is not confirmed is a 403 with a reason, before the key is looked at and without calling Anthropic", async () => {
  let reached = false;
  globalThis.fetch = async () => {
    reached = true;
    return { status: 200, json: async () => ({}) };
  };
  delete process.env.ANTHROPIC_API_KEY; // the refusal comes first
  for (const claims of [
    { uid: "u1", email_verified: false },
    { uid: "u1" },
    { uid: "u1", email_verified: "true" }, // only the real true counts
    { uid: "u1", email_verified: 1 },
    { uid: "u1", email_verified: null },
  ]) {
    deps.verify = async () => claims;
    const out = res();
    await handler({ method: "POST", headers: AS("u1"), body: { model: "m", messages: [] } }, out);
    assert.equal(out.statusCode, 403, JSON.stringify(claims));
    assert.deepEqual(out.body, {
      error: "Confirm your email address to use Claude.",
      code: "email_not_confirmed",
    });
    assert.equal(out.headers["x-vaulte-reason"], "email_not_confirmed");
  }
  assert.equal(reached, false);
});

test("a confirmed email is let through (a Google or emailed-link sign-in is confirmed already)", async () => {
  deps.verify = async () => ({ uid: "u1", email_verified: true });
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ content: [] }) });
  const out = res();
  await handler({ method: "POST", headers: AS("u1"), body: {} }, out);
  assert.equal(out.statusCode, 200);
  assert.equal(out.headers["x-vaulte-reason"], undefined);
});

test("a person who is not signed in still gets the 401, not the email message", async () => {
  const out = res();
  await handler({ method: "POST", body: {} }, out);
  assert.equal(out.statusCode, 401);
  assert.equal(out.headers["x-vaulte-reason"], undefined);
});
