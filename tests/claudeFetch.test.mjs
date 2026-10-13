// tests/claudeFetch.test.mjs — one call to /api/claude (Fix 126): the sign-in proof, and what happens
// when the proxy says the person's email address is not confirmed yet.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { claudeFetch, NOT_APPROVED_MESSAGE, UNCONFIRMED_MESSAGE } from "../src/api/claudeFetch.js";
import {
  setAuthTools,
  setTokenSource,
  refreshAuth,
  resendConfirmationOnce,
} from "../src/api/authToken.js";

const realFetch = globalThis.fetch;
let replies;
let sent;
let steps;
const ok = { status: 200, headers: { get: () => null }, json: async () => ({ ok: true }) };
const refused = {
  status: 403,
  headers: { get: (k) => (k === "x-vaulte-reason" ? "email_not_confirmed" : null) },
};
const waiting = {
  status: 403,
  headers: { get: (k) => (k === "x-vaulte-reason" ? "not_approved" : null) },
};
const otherRefusal = { status: 403, headers: { get: () => null } };

beforeEach(() => {
  replies = [];
  sent = [];
  steps = [];
  globalThis.fetch = async (url, opts) => {
    sent.push({ url, opts });
    return replies.shift() ?? ok;
  };
  setTokenSource(async () => "tok");
  setAuthTools({
    refresh: async () => steps.push("refresh"),
    resend: async () => steps.push("resend"),
  });
  mock.method(console, "warn", () => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  setTokenSource(null);
  setAuthTools(null);
  mock.restoreAll();
});

test("a call goes to /api/claude with the ID token and the body as JSON", async () => {
  const res = await claudeFetch({ model: "m", n: 1 });
  assert.equal(res, ok);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "/api/claude");
  assert.equal(sent[0].opts.method, "POST");
  assert.deepEqual(sent[0].opts.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer tok",
  });
  assert.equal(sent[0].opts.body, JSON.stringify({ model: "m", n: 1 }));
  assert.deepEqual(steps, []);
});

test("any other reply, 403 included, is handed back untouched", async () => {
  for (const reply of [
    otherRefusal,
    { status: 500, headers: {} },
    { status: 401 },
    { status: 403 },
  ]) {
    replies = [reply];
    assert.equal(await claudeFetch({}), reply);
  }
  assert.deepEqual(steps, []);
  assert.equal(sent.length, 4);
});

test("unconfirmed at first, confirmed by the retry (the link was opened since): refreshed, tried again, no email", async () => {
  replies = [refused, ok];
  const res = await claudeFetch({ a: 1 });
  assert.equal(res, ok);
  assert.deepEqual(steps, ["refresh"]);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].opts.body, sent[0].opts.body);
});

test("still unconfirmed after the refresh: the email is sent again and the person is told, in words", async () => {
  replies = [refused, refused];
  await assert.rejects(claudeFetch({}), { message: UNCONFIRMED_MESSAGE });
  assert.deepEqual(steps, ["refresh", "resend"]);
  assert.equal(sent.length, 2);
  assert.match(UNCONFIRMED_MESSAGE, /^Confirm your email address to use Claude\./);
});

test("the email is sent again only once per page load, however many calls are refused", async () => {
  for (let i = 0; i < 3; i++) {
    replies = [refused, refused];
    await assert.rejects(claudeFetch({}), { message: UNCONFIRMED_MESSAGE });
  }
  assert.deepEqual(
    steps.filter((s) => s === "resend"),
    ["resend"],
  );
  assert.deepEqual(steps.filter((s) => s === "refresh").length, 3);
});

test("a refresh or a resend that fails is logged and does not hide the real message", async () => {
  setAuthTools({
    refresh: async () => {
      throw new Error("offline");
    },
    resend: async () => {
      throw new Error("too many emails");
    },
  });
  replies = [refused, refused];
  await assert.rejects(claudeFetch({}), { message: UNCONFIRMED_MESSAGE });
  assert.deepEqual(
    console.warn.mock.calls.map((c) => c.arguments),
    [
      ["sign-in not refreshed:", "offline"],
      ["confirmation email not sent:", "too many emails"],
    ],
  );
});

test("auth tools: nothing set does nothing; a refresh returns; the resend reports whether it went", async () => {
  setAuthTools(null);
  await refreshAuth();
  assert.equal(await resendConfirmationOnce(), true); // no tool: nothing to fail, still counts as sent
  assert.equal(await resendConfirmationOnce(), false); // the second is refused
  setAuthTools({ resend: async () => steps.push("resend") }); // setting tools starts afresh
  assert.equal(await resendConfirmationOnce(), true);
  assert.deepEqual(steps, ["resend"]);
  setAuthTools({
    resend: async () => {
      throw new Error("x");
    },
  });
  assert.equal(await resendConfirmationOnce(), false); // a failed send is not "sent"
  assert.equal(await resendConfirmationOnce(), false); // and is not tried a second time either
});

test("not approved yet: the person is told, in words, with no refresh and no email (Fix 134)", async () => {
  replies = [waiting];
  await assert.rejects(claudeFetch({ a: 1 }), { message: NOT_APPROVED_MESSAGE });
  assert.deepEqual(steps, []);
  assert.equal(sent.length, 1);
  assert.match(NOT_APPROVED_MESSAGE, /^Claude is waiting for approval\./);
});

test("confirmed on the retry but not approved: told that, after one refresh", async () => {
  replies = [refused, waiting];
  await assert.rejects(claudeFetch({}), { message: NOT_APPROVED_MESSAGE });
  assert.deepEqual(steps, ["refresh"]);
  assert.equal(sent.length, 2);
});
