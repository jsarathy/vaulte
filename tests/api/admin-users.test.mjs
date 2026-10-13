// tests/api/admin-users.test.mjs — /api/admin-users (Fix 104, 105): who may ask, "check" and "list".
// The two things the handler calls out to (verifying the ID token, listing the users) are replaced
// through `deps`; their own tests are admin-verify.test.mjs and admin-users-store.test.mjs.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler, { deps } from "../../api/admin-users.js";
import { removeUser } from "../../api/_admin/remove.js";
import { listUsers } from "../../api/_admin/store.js";
import { verifyIdToken } from "../../api/_admin/verify.js";

const real = { ...deps };
const BOSS = { uid: "boss", email: "boss@example.com", email_verified: true };
const ROWS = [
  { uid: "u1", email: "jane@example.com" },
  { uid: "boss", email: "BOSS@example.com" },
];
const FLAGGED = [
  { uid: "u1", email: "jane@example.com", admin: false },
  { uid: "boss", email: "BOSS@example.com", admin: true },
];
let tokens;
let verifyCalls;
let listCalls;
let removed;

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
  removed = [];
  deps.remove = async (uid) => {
    removed.push(uid);
  };
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
  assert.deepEqual(out.body, { users: FLAGGED }); // each row says whether it is an admin address
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

// ---- delete (Fix 127)
const del = (uid, token = "good") => call({ action: "delete", uid }, token);

test("delete: an admin removes another user; the server is told which one, and it is logged", async () => {
  const log = mock.method(console, "log", () => {});
  const out = await del("u1");
  assert.deepEqual([out.statusCode, out.body], [200, { ok: true }]);
  assert.deepEqual(removed, ["u1"]);
  assert.deepEqual(
    log.mock.calls.map((c) => c.arguments),
    [["admin-users: deleted a user:", "u1"]],
  );
});

test("delete: not an admin is 403 and nothing is read or removed", async () => {
  const out = await del("u1", "other");
  assert.deepEqual([out.statusCode, out.body.error], [403, "Not an admin"]);
  assert.deepEqual(removed, []);
  assert.equal(listCalls, 0);
  const none = await del("u1", "");
  assert.equal(none.statusCode, 401);
  assert.deepEqual(removed, []);
});

test("delete: a missing or odd user id is 400 and nothing is looked up", async () => {
  for (const uid of [undefined, null, "", "a/b", "../x", "x y", 5, {}, "x".repeat(129)]) {
    const out = await del(uid);
    assert.deepEqual(
      [out.statusCode, out.body.error],
      [400, "Missing or invalid user id"],
      String(uid),
    );
  }
  assert.equal((await call({ action: "delete" })).statusCode, 400);
  assert.equal(
    (await call({ action: "delete" }, "good", "POST")).body.error,
    "Missing or invalid user id",
  );
  assert.equal(listCalls, 0);
  assert.deepEqual(removed, []);
});

test("delete: not your own account", async () => {
  const out = await del("boss");
  assert.deepEqual(
    [out.statusCode, out.body.error],
    [400, "You cannot delete your own account here"],
  );
  assert.deepEqual(removed, []);
});

test("delete: not another admin's, whatever the case of the address", async () => {
  process.env.ADMIN_EMAILS = "Boss@Example.com, jane@EXAMPLE.com";
  const out = await del("u1");
  assert.deepEqual([out.statusCode, out.body.error], [403, "That is an admin account"]);
  assert.deepEqual(removed, []);
});

test("delete: a user that is not in the list is 404", async () => {
  const out = await del("nobody");
  assert.deepEqual([out.statusCode, out.body.error], [404, "No such user"]);
  assert.deepEqual(removed, []);
});

test("delete: a failure is a 500 that says nothing about why, and is logged; a failing list too", async () => {
  const err = mock.method(console, "error", () => {});
  deps.remove = async () => {
    throw new Error("Login not deleted (500)");
  };
  let out = await del("u1");
  assert.deepEqual([out.statusCode, out.body], [500, { error: "Could not delete the user" }]);
  deps.list = async () => {
    throw new Error("down");
  };
  out = await del("u1");
  assert.deepEqual([out.statusCode, out.body], [500, { error: "Could not delete the user" }]);
  assert.equal(err.mock.calls.length, 2);
  assert.equal(err.mock.calls[0].arguments[0], "admin-users error:");
});

test("the real functions are the defaults: Google's keys, the Authentication and Firestore list, the full removal", () => {
  assert.equal(real.verify, verifyIdToken);
  assert.equal(real.list, listUsers);
  assert.equal(real.remove, removeUser);
});

test("list: a user with no email address is not an admin (and does not break the list)", async () => {
  deps.list = async () => [{ uid: "u9" }, { uid: "u8", email: "" }, { uid: "u7", email: null }];
  const out = await call({ action: "list" });
  assert.deepEqual(
    out.body.users.map((u) => u.admin),
    [false, false, false],
  );
});
