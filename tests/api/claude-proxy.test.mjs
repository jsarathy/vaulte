// tests/api/claude-proxy.test.mjs — /api/claude proxy (no Firestore). Anthropic API stubbed.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler from "../../api/claude.js";

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
  await handler({ method: "POST", body: {} }, out);
  assert.equal(out.statusCode, 500);
});

test("forwards the body with the key and passes the status through", async () => {
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return { status: 429, json: async () => ({ error: { type: "rate_limit" } }) };
  };
  const out = res();
  await handler({ method: "POST", body: { model: "m", messages: [] } }, out);
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
  await handler({ method: "POST", body: {} }, out);
  assert.deepEqual(out.body.content[0].content, [{ url: "u1", title: "t1" }]);
  assert.equal(out.body.content[1].text, "answer");
});
