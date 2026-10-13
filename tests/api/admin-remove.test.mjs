// tests/api/admin-remove.test.mjs — removing a user completely (Fix 127): the login, the profile
// photo and everything under users/{uid}. The REST calls are stubbed; the data delete runs on the
// Firestore emulator.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearFirestore, db, PROJECT } from "./setup.mjs";
import { removalSteps, removeUser, validUid } from "../../api/_admin/remove.js";

beforeEach(clearFirestore);

/** A fetch that answers from a list of replies and records what was asked. */
const stub = (...replies) => {
  const asked = [];
  const fetchJson = async (url, opts) => {
    asked.push({ url, opts });
    const r = replies.shift() ?? { status: 200, json: {} };
    return {
      ok: r.status < 300,
      status: r.status,
      json: async () => (r.badJson ? Promise.reject(new Error("x")) : r.json),
    };
  };
  return { fetchJson, asked };
};

test("validUid: letters, digits, - and _ up to 128 characters", () => {
  for (const ok of ["abc", "A1_b-2", "x".repeat(128), "FbUid123abcDEF456ghiJKL789"])
    assert.equal(validUid(ok), true, ok);
  for (const bad of ["", "a/b", "a b", "a.b", "x".repeat(129), 5, null, undefined, {}, ["a"]])
    assert.equal(validUid(bad), false, String(bad));
});

test("deleteLogin: asks Identity Toolkit to delete that account with the service account's token", async () => {
  const { fetchJson, asked } = stub({ status: 200 });
  await removalSteps({ token: "tok", fetchJson }).deleteLogin("u1");
  assert.equal(asked.length, 1);
  assert.equal(
    asked[0].url,
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`,
  );
  assert.equal(asked[0].opts.method, "POST");
  assert.deepEqual(asked[0].opts.headers, {
    Authorization: "Bearer tok",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(asked[0].opts.body), { localId: "u1" });
});

test("deleteLogin: a login that is already gone is fine; any other refusal throws with its status only", async () => {
  await removalSteps({
    token: "t",
    fetchJson: stub({ status: 400, json: { error: { message: "USER_NOT_FOUND" } } }).fetchJson,
  }).deleteLogin("u1");
  for (const reply of [
    { status: 400, json: { error: { message: "INVALID_LOCAL_ID" } } },
    { status: 403, json: { error: { message: "PERMISSION_DENIED secret detail" } } },
    { status: 500, badJson: true },
    { status: 401, json: {} },
  ]) {
    await assert.rejects(
      removalSteps({ token: "t", fetchJson: stub(reply).fetchJson }).deleteLogin("u1"),
      (e) => {
        assert.equal(e.message, `Login not deleted (${reply.status})`);
        return true;
      },
    );
  }
});

test("deletePhoto: deletes profile-photos/{uid}.jpg in the project's bucket; no photo (404) is fine; other failures throw", async () => {
  const { fetchJson, asked } = stub({ status: 204 });
  await removalSteps({ token: "tok", fetchJson }).deletePhoto("u1");
  assert.equal(
    asked[0].url,
    `https://storage.googleapis.com/storage/v1/b/${PROJECT}.firebasestorage.app/o/profile-photos%2Fu1.jpg`,
  );
  assert.deepEqual(asked[0].opts, { method: "DELETE", headers: { Authorization: "Bearer tok" } });
  await removalSteps({ token: "t", fetchJson: stub({ status: 404 }).fetchJson }).deletePhoto("u1");
  await assert.rejects(
    removalSteps({ token: "t", fetchJson: stub({ status: 500 }).fetchJson }).deletePhoto("u1"),
    { message: "Photo not deleted (500)" },
  );
  await assert.rejects(
    removalSteps({ token: "t", fetchJson: stub({ status: 403 }).fetchJson }).deletePhoto("u1"),
    { message: "Photo not deleted (403)" },
  );
});

test("deleteData: the profile and every collection under it go; another user's data stays", async () => {
  const seed = (path) => db().doc(path).set({ x: 1 });
  for (const p of [
    "users/u1",
    "users/u1/recipes/r1",
    "users/u1/recipes/r2",
    "users/u1/nutrition_days/2026-10-01",
    "users/u1/polar/connection_v4",
    "users/u1/polar_sessions/s1/extra/e1",
  ])
    await seed(p);
  for (const p of [
    "users/u2",
    "users/u2/recipes/r1",
    "users/u10/recipes/r1",
    "ai_usage_unattributed/a1",
  ])
    await seed(p);
  await removalSteps({ token: "t" }).deleteData("u1");
  for (const p of [
    "users/u1",
    "users/u1/recipes/r1",
    "users/u1/recipes/r2",
    "users/u1/nutrition_days/2026-10-01",
    "users/u1/polar/connection_v4",
    "users/u1/polar_sessions/s1/extra/e1",
  ]) {
    assert.equal((await db().doc(p).get()).exists, false, p);
  }
  for (const p of [
    "users/u2",
    "users/u2/recipes/r1",
    "users/u10/recipes/r1",
    "ai_usage_unattributed/a1",
  ]) {
    assert.equal((await db().doc(p).get()).exists, true, p);
  }
});

test("removeUser: the login first, then the photo, then the data; a failure stops the rest", async () => {
  const order = [];
  const steps = {
    deleteLogin: async (u) => order.push(["login", u]),
    deletePhoto: async (u) => order.push(["photo", u]),
    deleteData: async (u) => order.push(["data", u]),
  };
  await removeUser("u1", steps);
  assert.deepEqual(order, [
    ["login", "u1"],
    ["photo", "u1"],
    ["data", "u1"],
  ]);
  order.length = 0;
  await assert.rejects(
    removeUser("u1", {
      ...steps,
      deleteLogin: async () => {
        throw new Error("no");
      },
    }),
    { message: "no" },
  );
  assert.deepEqual(order, []); // nothing else touched: the person is still whole and can be tried again
  await assert.rejects(
    removeUser("u1", {
      ...steps,
      deletePhoto: async () => {
        throw new Error("nope");
      },
    }),
    { message: "nope" },
  );
  assert.deepEqual(order, [["login", "u1"]]); // the data waits for the next try
});

test("without a stand-in the steps use the real fetch", async () => {
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, opts) => {
    asked.push([String(url), opts.method]);
    return { ok: true, status: 204 };
  };
  try {
    await removalSteps({ token: "t" }).deletePhoto("u1");
    await removalSteps({ token: "t" }).deleteLogin("u1");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(
    asked.map((a) => a[1]),
    ["DELETE", "POST"],
  );
});
