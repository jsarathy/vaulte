// tests/api/admin-users-store.test.mjs — reading the users for the Users card (api/_admin/store.js,
// Fix 105): the Authentication list through the Identity Toolkit REST API (paged, with a bearer
// token) joined with the profile documents in Firestore (emulator). The REST calls are replaced.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { clearFirestore, db } from "./setup.mjs";
import { authUsers, listUsers } from "../../api/_admin/store.js";

const user = (n, extra = {}) => ({
  localId: `u${n}`,
  email: `u${n}@x.com`,
  createdAt: String(Date.parse("2026-10-0" + n + "T08:00:00Z")),
  lastLoginAt: String(Date.parse("2026-10-11T09:00:00Z")),
  providerUserInfo: [{ providerId: "password", rawId: "x" }],
  ...extra,
});
let calls;
const pages = (list) => async (url, headers) => {
  calls.push({ url, headers });
  const page = list[calls.length - 1];
  return { ok: true, status: 200, json: async () => page };
};

beforeEach(async () => {
  await clearFirestore();
  calls = [];
});

test("authUsers: asks the project's list with the bearer token and maps each user", async () => {
  const fetchJson = pages([{ users: [user(1, { displayName: "Una", disabled: true })] }]);
  const out = await authUsers({ token: "tok", fetchJson });
  assert.equal(calls.length, 1);
  assert.match(
    calls[0].url,
    /^https:\/\/identitytoolkit\.googleapis\.com\/v1\/projects\/demo-vaulte\/accounts:batchGet\?maxResults=1000$/,
  );
  assert.deepEqual(calls[0].headers, { Authorization: "Bearer tok" });
  assert.deepEqual(out, [
    {
      uid: "u1",
      email: "u1@x.com",
      displayName: "Una",
      disabled: true,
      metadata: {
        creationTime: "2026-10-01T08:00:00.000Z",
        lastSignInTime: "2026-10-11T09:00:00.000Z",
      },
      providerData: [{ providerId: "password" }],
    },
  ]);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("authUsers: without a replacement it uses fetch, sending the bearer token", async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url, headers: options.headers });
    return { ok: true, status: 200, json: async () => ({ users: [user(1)] }) };
  };
  const out = await authUsers({ token: "real-token" });
  assert.deepEqual(
    out.map((u) => u.uid),
    ["u1"],
  );
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /^https:\/\/identitytoolkit\.googleapis\.com\//);
  assert.deepEqual(seen[0].headers, { Authorization: "Bearer real-token" });
});

test("authUsers: follows the next page token until there is none", async () => {
  const fetchJson = pages([
    { users: [user(1)], nextPageToken: "p2" },
    { users: [user(2)], nextPageToken: "p3" },
    { users: [user(3)] },
  ]);
  const out = await authUsers({ token: "tok", fetchJson });
  assert.deepEqual(
    out.map((u) => u.uid),
    ["u1", "u2", "u3"],
  );
  assert.equal(calls.length, 3);
  assert.doesNotMatch(calls[0].url, /nextPageToken/);
  assert.match(calls[1].url, /&nextPageToken=p2$/);
  assert.match(calls[2].url, /&nextPageToken=p3$/);
});

test("authUsers: no users on a page is fine; a failed request throws", async () => {
  assert.deepEqual(await authUsers({ token: "t", fetchJson: pages([{}]) }), []);
  const failing = async () => ({ ok: false, status: 403, json: async () => ({}) });
  await assert.rejects(
    authUsers({ token: "t", fetchJson: failing }),
    /Authentication list failed \(403\)/,
  );
});

test("listUsers: Authentication joined with the profiles, oldest first; a profile with no sign-in record is kept", async () => {
  await db()
    .doc("users/u1")
    .set({ firstName: "Jane", lastName: "Smith", phone: "+44 1", city: "London", uid: "USR-1" });
  await db().doc("users/ghost").set({ firstName: "Gone", email: "gone@x.com" });
  const fetchJson = pages([{ users: [user(2), user(1)] }]);
  const users = await listUsers({ token: "tok", fetchJson });
  assert.deepEqual(
    users.map((u) => [u.uid, u.name, u.email, u.member_id, u.phone, u.address, u.providers]),
    [
      ["u1", "Jane Smith", "u1@x.com", "USR-1", "+44 1", "London", ["password"]],
      ["u2", "", "u2@x.com", "", "", "", ["password"]],
      ["ghost", "Gone", "gone@x.com", "", "", "", []],
    ],
  );
  assert.equal(users[0].created, "2026-10-01T08:00:00.000Z");
  assert.equal(users[0].last_sign_in, "2026-10-11T09:00:00.000Z");
  // only account fields: nothing from the health data
  assert.deepEqual(Object.keys(users[0]).sort(), [
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
