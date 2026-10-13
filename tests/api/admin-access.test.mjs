// tests/api/admin-access.test.mjs — who may use Claude (Fix 134): api/_admin/access.js. The decision is
// tested with a fake store; the real store against the Firestore emulator; the login lookup with a
// fake fetch.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearFirestore } from "./setup.mjs";
import {
  GRANDFATHER_BEFORE,
  accessOf,
  allApprovals,
  approve,
  createdAtOf,
  realStore,
} from "../../api/_admin/access.js";

const AFTER = GRANDFATHER_BEFORE + 86_400_000;
const BEFORE = GRANDFATHER_BEFORE - 86_400_000;
const JANE = { uid: "u1", email: "jane@example.com", email_verified: true };

/** A store in memory: records by uid, and the login creation time to answer. */
function fakeStore({ records = {}, created = AFTER, raceWinner = false } = {}) {
  const calls = [];
  return {
    records,
    calls,
    get: async (uid) => records[uid] ?? null,
    create: async (uid, data) => {
      calls.push(["create", uid, data.status]);
      if (raceWinner) {
        records[uid] = { status: "pending" }; // another request made it first
        return false;
      }
      if (records[uid]) return false;
      records[uid] = data;
      return true;
    },
    set: async (uid, data) => {
      calls.push(["set", uid, data.status]);
      records[uid] = { ...records[uid], ...data };
    },
    all: async () => records,
    createdAt: async () => created,
  };
}

beforeEach(async () => {
  await clearFirestore();
  process.env.ADMIN_EMAILS = "boss@example.com";
});

test("an admin is approved at once, with nothing read or written", async () => {
  const store = fakeStore();
  store.get = async () => assert.fail("no read for an admin");
  const out = await accessOf(
    { uid: "b", email: "Boss@Example.com", email_verified: true },
    { store },
  );
  assert.deepEqual(out, { approved: true });
});

test("an email that is not confirmed is not approved, and nothing is recorded or sent", async () => {
  const store = fakeStore();
  const sent = [];
  const out = await accessOf(
    { ...JANE, email_verified: false },
    { store, notify: async (p) => sent.push(p) },
  );
  assert.deepEqual(out, { approved: false });
  assert.deepEqual(store.calls, []);
  assert.deepEqual(sent, []);
});

test("an approved record lets the person in; a pending one does not; neither is rewritten or announced again", async () => {
  const sent = [];
  const notify = async (p) => sent.push(p);
  const yes = fakeStore({ records: { u1: { status: "approved" } } });
  assert.deepEqual(await accessOf(JANE, { store: yes, notify }), { approved: true });
  const wait = fakeStore({ records: { u1: { status: "pending" } } });
  assert.deepEqual(await accessOf(JANE, { store: wait, notify }), { approved: false });
  assert.deepEqual([...yes.calls, ...wait.calls], []);
  assert.deepEqual(sent, []);
});

test("an account made before the cut-off is approved as existing, with no email", async () => {
  const store = fakeStore({ created: BEFORE });
  const sent = [];
  assert.deepEqual(await accessOf(JANE, { store, notify: async (p) => sent.push(p) }), {
    approved: true,
  });
  assert.equal(store.records.u1.status, "approved");
  assert.equal(store.records.u1.source, "existing");
  assert.deepEqual(sent, []);
});

test("an account made at or after the cut-off is recorded as waiting and the admins are told once", async () => {
  const sent = [];
  for (const created of [GRANDFATHER_BEFORE, AFTER]) {
    const store = fakeStore({ created });
    const notify = async (p) => sent.push(p);
    assert.deepEqual(await accessOf(JANE, { store, notify }), { approved: false });
    assert.equal(store.records.u1.status, "pending");
    assert.equal(store.records.u1.email, "jane@example.com");
    assert.match(store.records.u1.requestedAt, /^\d{4}-\d\d-\d\dT/);
    assert.deepEqual(await accessOf(JANE, { store, notify }), { approved: false }); // asking again: no second email
  }
  assert.deepEqual(sent, [{ email: "jane@example.com" }, { email: "jane@example.com" }]);
});

test("two requests at once: the one that lost the race sends no email", async () => {
  const sent = [];
  const store = fakeStore({ raceWinner: true });
  assert.deepEqual(await accessOf(JANE, { store, notify: async (p) => sent.push(p) }), {
    approved: false,
  });
  assert.deepEqual(sent, []);
});

test("if the creation time cannot be told the person is treated as new, not grandfathered", async () => {
  const store = fakeStore({ created: null });
  assert.deepEqual(await accessOf(JANE, { store, notify: async () => {} }), { approved: false });
  assert.equal(store.records.u1.status, "pending");
});

test("a failing lookup or store is an error for the caller to refuse on (nothing let through)", async () => {
  const store = fakeStore();
  store.createdAt = async () => {
    throw new Error("lookup down");
  };
  await assert.rejects(accessOf(JANE, { store, notify: async () => {} }), {
    message: "lookup down",
  });
});

test("approve: records who approved and when, keeping the rest of the record", async () => {
  const store = fakeStore({ records: { u1: { status: "pending", email: "jane@example.com" } } });
  await approve("u1", "boss", store);
  assert.deepEqual(store.calls, [["set", "u1", "approved"]]);
  const r = store.records.u1;
  assert.deepEqual(
    [r.status, r.source, r.approvedBy, r.email],
    ["approved", "admin", "boss", "jane@example.com"],
  );
  assert.match(r.at, /^\d{4}-/);
  assert.deepEqual(await allApprovals(store), store.records);
});

// ---- the real store, on the emulator
test("realStore: create makes a record once, set merges, get and all read them", async () => {
  assert.equal(await realStore.get("s1"), null);
  assert.equal(await realStore.create("s1", { status: "pending", email: "a@b.c" }), true);
  assert.equal(await realStore.create("s1", { status: "approved" }), false); // already there: left alone
  assert.deepEqual(await realStore.get("s1"), { status: "pending", email: "a@b.c" });
  await realStore.set("s1", { status: "approved" });
  assert.deepEqual(await realStore.get("s1"), { status: "approved", email: "a@b.c" });
  await realStore.set("s2", { status: "pending" });
  const all = await realStore.all();
  assert.deepEqual([all.s1.status, all.s2.status], ["approved", "pending"]);
});

test("realStore.create: an error that is not 'already exists' is passed on", async () => {
  await assert.rejects(realStore.create("a/b", { status: "x" })); // an odd id is not a document path
});

// ---- the login lookup
test("createdAtOf: asks Identity Toolkit for the user and reads its creation time", async () => {
  process.env.FIREBASE_PROJECT_ID = "demo-project";
  const seen = [];
  const fetchJson = async (url, opts) => {
    seen.push([url, opts]);
    return { ok: true, json: async () => ({ users: [{ createdAt: "1760000000000" }] }) };
  };
  assert.equal(await createdAtOf("u1", { token: "tok", fetchJson }), 1760000000000);
  const [url, opts] = seen[0];
  assert.match(
    url,
    /^https:\/\/identitytoolkit\.googleapis\.com\/v1\/projects\/.+\/accounts:lookup$/,
  );
  assert.equal(opts.method, "POST");
  assert.equal(opts.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(opts.body), { localId: ["u1"] });
});

test("createdAtOf: no such user or no time is null; a refused lookup is an error", async () => {
  const reply =
    (body, ok = true, status = 200) =>
    async () => ({ ok, status, json: async () => body });
  assert.equal(await createdAtOf("u1", { token: "t", fetchJson: reply({}) }), null);
  assert.equal(await createdAtOf("u1", { token: "t", fetchJson: reply({ users: [{}] }) }), null);
  await assert.rejects(createdAtOf("u1", { token: "t", fetchJson: reply({}, false, 403) }), {
    message: "Login lookup failed (403)",
  });
});
