// tests/authToken.test.mjs — the sign-in proof a call to a server function carries (Fix 118).
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { authHeader, setTokenSource } from "../src/api/authToken.js";

afterEach(() => setTokenSource(null));

test("authHeader: a Bearer header from the token source", async () => {
  setTokenSource(async () => "abc.def");
  assert.deepEqual(await authHeader(), { Authorization: "Bearer abc.def" });
  setTokenSource(() => "sync-token"); // a plain function works too
  assert.deepEqual(await authHeader(), { Authorization: "Bearer sync-token" });
});

test("authHeader: nobody signed in gives no header, whatever the source says", async () => {
  assert.deepEqual(await authHeader(), {}); // no source set
  for (const nothing of [null, undefined, ""]) {
    setTokenSource(async () => nothing);
    assert.deepEqual(await authHeader(), {});
  }
  setTokenSource(async () => "t");
  setTokenSource(null); // taking the source away
  assert.deepEqual(await authHeader(), {});
  setTokenSource(async () => "t");
  setTokenSource(undefined);
  assert.deepEqual(await authHeader(), {});
});

test("authHeader: a failing token source is not hidden", async () => {
  setTokenSource(async () => {
    throw new Error("token service down");
  });
  await assert.rejects(authHeader(), /token service down/);
});
