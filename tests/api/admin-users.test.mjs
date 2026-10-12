// tests/api/admin-users.test.mjs — /api/admin-users (Fix 104, 105): who may ask, "check" and "list".
// The two things the handler calls out to (verifying the ID token, listing the users) are replaced
// through `deps`; their own tests are admin-verify.test.mjs and admin-users-store.test.mjs.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler, { deps } from "../../api/admin-users.js";

const real = { ...deps };
const BOSS = { uid: "boss", email: "boss@example.com", email_verified: true };
const ROWS = [{ uid: "u1", email: "jane@example.com" }];
let tokens;
let verifyCalls;
let listCalls;

const call = async (body, token = "good", method = "POST") => {
  const out = res();
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, out);
  return out;
};

beforeEach(() => {
  process.env.ADMIN_EMAILS = "Boss@Example.com";
  tokens = { good: BOSS, other: { uid: "u2", email: "x@example.com", email_verified: true } };
  verifyCalls = [];
  listCalls = 0;
  deps.verify = async (t) => {
    verifyCalls.push(t);
    if (!tokens[t]) throw new Error("bad token");
    return tokens[t];
  };
  deps.list = async () => {
    listCalls += 1;
    return ROWS;
  };
});
afterEach(() => {
  Object.assign(deps, real);
  mock.restoreAll();
  delete process.env.ADMIN_EMAILS;
});

test("only POST", async () => {
  const out = await call({ action: "check" }, "good", "GET");
  assert.equal(out.statusCode, 405);
  assert.equal(out.body.error, "POST only");
});

test("no token, or a token that does not verify: 401, and nothing is listed", async () => {
  const none = await call({ action: "list" }, "");
  assert.equal(none.statusCode, 401);
  assert.equal(none.body.error, "Sign in first");
  const bad = await call({ action: "list" }, "forged");
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.body.error, "Invalid sign-in");
  assert.deepEqual(verifyCalls, ["forged"]); // the token itself, without "Bearer"
  assert.equal(listCalls, 0);
});

test("a request with no headers at all is a 401, not a crash", async () => {
  const out = res();
  await handler({ method: "POST", body: { action: "list" } }, out);
  assert.equal(out.statusCode, 401);
  assert.equal(out.body.error, "Sign in first");
});

test("the Bearer prefix is any case and may have more than one space", async () => {
  const out = res();
  await handler(
    { method: "POST", headers: { authorization: "bearer   good" }, body: { action: "check" } },
    out,
  );
  assert.deepEqual(out.body, { admin: true });
  assert.deepEqual(verifyCalls, ["good"]);
});

test("check: true for a listed address (any case), false for anyone else, and for an unverified email", async () => {
  assert.deepEqual((await call({ action: "check" })).body, { admin: true });
  assert.deepEqual((await call({ action: "check" }, "other")).body, { admin: false });
  tokens.unverified = { ...BOSS, email_verified: false };
  assert.deepEqual((await call({ action: "check" }, "unverified")).body, { admin: false });
  delete process.env.ADMIN_EMAILS; // not configured: nobody
  assert.deepEqual((await call({ action: "check" })).body, { admin: false });
});

test("list: an admin gets the users", async () => {
  const out = await call({ action: "list" });
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body, { users: ROWS });
  assert.equal(listCalls, 1);
});

test("list: not an admin is 403 and nothing is read", async () => {
  const out = await call({ action: "list" }, "other");
  assert.equal(out.statusCode, 403);
  assert.equal(out.body.error, "Not an admin");
  assert.equal(listCalls, 0);
});

test("an unknown or missing action is 400", async () => {
  const unknown = await call({ action: "delete-everyone" });
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.body.error, "Unknown action");
  assert.equal((await call({})).statusCode, 400);
  assert.equal((await call(undefined)).statusCode, 400);
});

test("list: a failure is a 500 that says nothing about why, and is logged", async () => {
  const err = mock.method(console, "error", () => {});
  deps.list = async () => {
    throw new Error("secret detail");
  };
  const out = await call({ action: "list" });
  assert.equal(out.statusCode, 500);
  assert.equal(out.body.error, "Could not list the users");
  assert.doesNotMatch(JSON.stringify(out.body), /secret/);
  assert.ok(err.mock.calls.some((c) => c.arguments[0] === "admin-users error:"));
});
