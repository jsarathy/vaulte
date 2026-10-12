// tests/api/admin-users.test.mjs — /api/admin-users (Fix 104): who may ask, "check" and "list", the
// merge of Firebase Authentication with the Firestore profiles (emulator). Firebase Authentication
// itself is stubbed: verifyIdToken and listUsers are replaced on the Auth class.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { getAuth } from "firebase-admin/auth";
import { res, clearFirestore, db } from "./setup.mjs";
import handler from "../../api/admin-users.js";

const BOSS = { uid: "boss", email: "boss@example.com", email_verified: true };
const proto = () => Object.getPrototypeOf(getAuth());
let tokens;
let listCalls;
const asUsers = (list) => (_n, token) => {
  listCalls.push(token);
  return Promise.resolve(list(token));
};

const call = async (body, token = "good", method = "POST") => {
  const out = res();
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, out);
  return out;
};

beforeEach(async () => {
  await clearFirestore();
  process.env.ADMIN_EMAILS = "Boss@Example.com";
  tokens = { good: BOSS, other: { uid: "u2", email: "x@example.com", email_verified: true } };
  listCalls = [];
  mock.method(proto(), "verifyIdToken", async (t) => {
    if (!tokens[t]) throw new Error("bad token");
    return tokens[t];
  });
  mock.method(
    proto(),
    "listUsers",
    asUsers(() => ({ users: [] })),
  );
});
afterEach(() => {
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
  assert.deepEqual(listCalls, []);
});

test("a request with no headers at all is a 401, not a crash", async () => {
  const out = res();
  await handler({ method: "POST", body: { action: "list" } }, out);
  assert.equal(out.statusCode, 401);
  assert.equal(out.body.error, "Sign in first");
});

test("check: true for a listed address (any case), false for anyone else, and for an unverified email", async () => {
  assert.deepEqual((await call({ action: "check" })).body, { admin: true });
  assert.deepEqual((await call({ action: "check" }, "other")).body, { admin: false });
  tokens.unverified = { ...BOSS, email_verified: false };
  assert.deepEqual((await call({ action: "check" }, "unverified")).body, { admin: false });
  delete process.env.ADMIN_EMAILS; // not configured: nobody
  assert.deepEqual((await call({ action: "check" })).body, { admin: false });
});

test("list: not an admin is 403 and nothing is read", async () => {
  const out = await call({ action: "list" }, "other");
  assert.equal(out.statusCode, 403);
  assert.equal(out.body.error, "Not an admin");
  assert.deepEqual(listCalls, []);
});

test("an unknown or missing action is 400", async () => {
  const unknown = await call({ action: "delete-everyone" });
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.body.error, "Unknown action");
  assert.equal((await call({})).statusCode, 400);
  assert.equal((await call(undefined)).statusCode, 400);
});

test("list: Authentication joined with the profiles, oldest first; a profile with no sign-in record is kept", async () => {
  mock.method(
    proto(),
    "listUsers",
    asUsers(() => ({
      users: [
        {
          uid: "u2",
          email: "later@example.com",
          metadata: {
            creationTime: "Fri, 09 Oct 2026 08:00:00 GMT",
            lastSignInTime: "Sun, 11 Oct 2026 08:00:00 GMT",
          },
          providerData: [{ providerId: "password" }],
        },
        {
          uid: "u1",
          email: "jane@example.com",
          displayName: "Jane G",
          metadata: {
            creationTime: "Thu, 01 Oct 2026 08:05:00 GMT",
            lastSignInTime: "Sun, 11 Oct 2026 14:32:00 GMT",
          },
          providerData: [{ providerId: "google.com" }],
        },
      ],
    })),
  );
  await db()
    .doc("users/u1")
    .set({ firstName: "Jane", lastName: "Smith", phone: "+44 1", city: "London", uid: "USR-1" });
  await db().doc("users/ghost").set({ firstName: "Gone", email: "gone@example.com" });
  const out = await call({ action: "list" });
  assert.equal(out.statusCode, 200);
  assert.deepEqual(
    out.body.users.map((u) => [
      u.uid,
      u.name,
      u.email,
      u.member_id,
      u.phone,
      u.address,
      u.providers,
    ]),
    [
      ["u1", "Jane Smith", "jane@example.com", "USR-1", "+44 1", "London", ["google.com"]],
      ["u2", "", "later@example.com", "", "", "", ["password"]],
      ["ghost", "Gone", "gone@example.com", "", "", "", []],
    ],
  );
  assert.equal(out.body.users[0].created, "2026-10-01T08:05:00.000Z");
  assert.equal(out.body.users[0].last_sign_in, "2026-10-11T14:32:00.000Z");
  // nothing from the health data comes through: only the account fields
  assert.deepEqual(Object.keys(out.body.users[0]).sort(), [
    "address",
    "created",
    "disabled",
    "email",
    "last_sign_in",
    "member_id",
    "name",
    "phone",
    "providers",
    "uid",
  ]);
});

test("list: every page of Authentication users is read", async () => {
  const user = (n) => ({ uid: `u${n}`, email: `u${n}@x.com`, metadata: {}, providerData: [] });
  mock.method(
    proto(),
    "listUsers",
    asUsers((token) => (token ? { users: [user(2)] } : { users: [user(1)], pageToken: "next" })),
  );
  const out = await call({ action: "list" });
  assert.deepEqual(out.body.users.map((u) => u.uid).sort(), ["u1", "u2"]);
  assert.deepEqual(listCalls, [undefined, "next"]);
});

test("list: a failure is a 500 that says nothing about why, and is logged", async () => {
  const err = mock.method(console, "error", () => {});
  mock.method(proto(), "listUsers", async () => {
    throw new Error("secret detail");
  });
  const out = await call({ action: "list" });
  assert.equal(out.statusCode, 500);
  assert.equal(out.body.error, "Could not list the users");
  assert.doesNotMatch(JSON.stringify(out.body), /secret/);
  assert.ok(err.mock.calls.some((c) => c.arguments[0] === "admin-users error:"));
});
