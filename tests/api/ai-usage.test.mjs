// tests/api/ai-usage.test.mjs — the /api/claude proxy keeps a record of each call's size and cost
// (Fix 41) in users/{uid}/ai_usage; Anthropic is stubbed, Firestore is the emulator.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, db } from "./setup.mjs";
import handler from "../../api/claude.js";

const realFetch = globalThis.fetch;
let sent;
const USAGE = { input_tokens: 400, output_tokens: 200 };
const stub = (status, body) => {
  globalThis.fetch = async (url, opts) => {
    if (!String(url).includes("api.anthropic.com")) return realFetch(url, opts);
    sent = JSON.parse(opts.body);
    return { status, json: async () => body };
  };
};
const call = async (body) => {
  const out = res();
  await handler({ method: "POST", body }, out);
  return out;
};
const records = async (path) => (await db().collection(path).get()).docs.map((d) => d.data());

beforeEach(async () => {
  await clearFirestore();
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restoreAll();
});

test("a call is recorded under its user with the feature, sizes and cost", async () => {
  stub(200, { content: [], usage: USAGE, stop_reason: "end_turn" });
  const out = await call({
    model: "claude-sonnet-4-6",
    messages: [],
    _usage: { feature: "chat", userId: "u1" },
  });
  assert.equal(out.statusCode, 200);
  const [rec] = await records("users/u1/ai_usage");
  assert.equal(rec.feature, "chat");
  assert.equal(rec.model, "claude-sonnet-4-6");
  assert.deepEqual([rec.input_tokens, rec.output_tokens, rec.cost_usd], [400, 200, 0.0042]);
  assert.deepEqual([rec.status, rec.stop_reason, rec.web_searches], [200, "end_turn", 0]);
  assert.match(rec.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(rec.ms >= 0 && rec.ms < 60_000); // how long the call took, in ms
  assert.deepEqual(
    Object.keys(rec).sort(),
    [
      "at",
      "cache_read_tokens",
      "cache_write_tokens",
      "cost_usd",
      "feature",
      "input_tokens",
      "ms",
      "model",
      "output_tokens",
      "status",
      "stop_reason",
      "web_searches",
    ].sort(),
  ); // sizes only: nothing of the prompt or the reply
});

test("the _usage field is taken off before the request goes to Anthropic", async () => {
  stub(200, { content: [], usage: USAGE });
  await call({
    model: "claude-sonnet-4-6",
    max_tokens: 5,
    _usage: { feature: "chat", userId: "u1" },
  });
  assert.deepEqual(sent, { model: "claude-sonnet-4-6", max_tokens: 5 });
});

test("web searches are counted and priced", async () => {
  stub(200, { content: [], usage: { ...USAGE, server_tool_use: { web_search_requests: 2 } } });
  await call({ model: "claude-sonnet-4-6", _usage: { feature: "create_recipe", userId: "u1" } });
  const [rec] = await records("users/u1/ai_usage");
  assert.equal(rec.web_searches, 2);
  assert.equal(rec.cost_usd, 0.0242); // 400 in + 200 out + two searches at a cent
});

test("a call with no readable user id is kept as unattributed; a bad feature name becomes unknown", async () => {
  stub(200, { content: [], usage: USAGE });
  await call({ model: "claude-sonnet-4-6" });
  await call({ model: "claude-sonnet-4-6", _usage: { feature: "Bad Name!", userId: "x/y" } });
  const loose = await records("ai_usage_unattributed");
  assert.equal(loose.length, 2);
  assert.deepEqual(
    loose.map((r) => [r.feature, r.user_id]),
    [
      ["unknown", null],
      ["unknown", null],
    ],
  );
});

test("an error reply from Anthropic has no usage: it is passed on and nothing is recorded", async () => {
  stub(429, { error: { type: "rate_limit" } });
  const out = await call({ model: "claude-sonnet-4-6", _usage: { feature: "chat", userId: "u1" } });
  assert.equal(out.statusCode, 429);
  assert.deepEqual(await records("users/u1/ai_usage"), []);
});

test("a model whose price is not known is recorded with no cost", async () => {
  stub(200, { content: [], usage: USAGE });
  await call({ model: "claude-future-9", _usage: { feature: "chat", userId: "u1" } });
  const [rec] = await records("users/u1/ai_usage");
  assert.equal(rec.cost_usd, null);
  assert.equal(rec.input_tokens, 400);
});

test("when the record cannot be saved the call still succeeds, and the failure is logged", async () => {
  const err = mock.method(console, "error", () => {});
  stub(200, { content: [{ type: "text", text: "hi" }], usage: USAGE });
  // break the write itself
  mock.method(Object.getPrototypeOf(db()), "collection", () => {
    throw new Error("disk on fire");
  });
  const out = await call({ model: "claude-sonnet-4-6", _usage: { feature: "chat", userId: "u1" } });
  mock.restoreAll();
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.content[0].text, "hi");
  assert.ok(
    err.mock.calls.some(
      (c) => c.arguments[0] === "ai usage not saved:" && /disk on fire/.test(c.arguments[1]),
    ),
  );
});
