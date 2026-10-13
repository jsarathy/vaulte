// tests/api/firestore-rules.test.mjs — firestore.rules (Fix 122), run by the Firestore emulator
// (which loads the rules from firebase.json). Requests go to the emulator's REST interface as a
// signed-in person (an unsigned test token, as the emulator accepts), as someone else, or with no
// sign-in at all; the server (Firebase Admin) is not bound by the rules and is checked to be unaffected.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearFirestore, db, PROJECT } from "./setup.mjs";

const BASE = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const token = (uid) =>
  `${b64({ alg: "none", typ: "JWT" })}.${b64({ user_id: uid, sub: uid, aud: PROJECT, iat: 1, exp: 9_999_999_999 })}.`;
const FIELDS = { fields: { x: { stringValue: "1" } } };

/** The HTTP status of an action as `uid` (null: not signed in): 200 allowed, 403 refused. */
async function act(verb, path, uid) {
  const headers = {
    "Content-Type": "application/json",
    ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}),
  };
  const init = { headers, method: { get: "GET", write: "PATCH", delete: "DELETE" }[verb] };
  if (verb === "write") init.body = JSON.stringify(FIELDS);
  return (await fetch(`${BASE}/${path}`, init)).status;
}
const seed = (path) => db().doc(path).set({ x: "seeded" });

beforeEach(clearFirestore);

// what a person keeps in the app: all their own, nobody else's
const OWN = [
  "users/u1",
  "users/u1/nutrition_days/2026-10-01",
  "users/u1/recipes/r1",
  "users/u1/weight_log/2026-10-01",
  "users/u1/body_log/2026-10-01",
  "users/u1/weight_plan/settings",
  "users/u1/monthly_targets/2026-10",
  "users/u1/routine_log/2026-10-01",
  "users/u1/settings/calculator",
  "users/u1/claude_chat/conversation",
  "users/u1/polar_sessions/s1",
];

test("a person reads, creates, changes and deletes their own data", async () => {
  for (const path of OWN) {
    assert.equal(await act("write", path, "u1"), 200, `create ${path}`);
    assert.equal(await act("get", path, "u1"), 200, `read ${path}`);
    assert.equal(await act("write", path, "u1"), 200, `change ${path}`);
    assert.equal(await act("delete", path, "u1"), 200, `delete ${path}`);
  }
});

test("a person may list their own collections", async () => {
  await seed("users/u1/recipes/r1");
  for (const col of [
    "recipes",
    "nutrition_days",
    "weight_log",
    "polar_sessions",
    "app_errors",
    "ai_usage",
    "apple_activity",
  ]) {
    assert.equal(await act("get", `users/u1/${col}`, "u1"), 200, col);
  }
});

test("nobody else, and nobody signed out, can touch another person's data", async () => {
  for (const path of OWN) {
    await seed(path);
    for (const who of ["u2", null]) {
      const as = who ?? "nobody";
      assert.equal(await act("get", path, who), 403, `${as} reads ${path}`);
      assert.equal(await act("write", path, who), 403, `${as} writes ${path}`);
      assert.equal(await act("delete", path, who), 403, `${as} deletes ${path}`);
    }
    assert.deepEqual((await db().doc(path).get()).data(), { x: "seeded" }, `${path} untouched`);
  }
  for (const col of ["recipes", "nutrition_days", "weight_log", "claude_chat", "polar_sessions"]) {
    assert.equal(await act("get", `users/u1/${col}`, "u2"), 403, `u2 lists ${col}`);
    assert.equal(await act("get", `users/u1/${col}`, null), 403, `nobody lists ${col}`);
  }
});

test("the error log: the person adds entries and reads them, but cannot change or delete one; others cannot touch it", async () => {
  const entry = "users/u1/app_errors/e1";
  assert.equal(await act("write", entry, "u1"), 200); // create
  assert.equal(await act("get", entry, "u1"), 200);
  assert.equal(await act("get", "users/u1/app_errors", "u1"), 200);
  assert.equal(await act("write", entry, "u1"), 403); // an existing entry is not changed
  assert.equal(await act("delete", entry, "u1"), 403);
  for (const who of ["u2", null]) {
    assert.equal(await act("get", entry, who), 403);
    assert.equal(await act("write", "users/u1/app_errors/e2", who), 403);
    assert.equal(await act("delete", entry, who), 403);
  }
  assert.deepEqual((await db().doc(entry).get()).data(), { x: "1" });
});

test("what the server writes (Apple activity, Claude usage) the person may read but not write", async () => {
  for (const path of ["users/u1/apple_activity/2026-10-01", "users/u1/ai_usage/c1"]) {
    await seed(path);
    assert.equal(await act("get", path, "u1"), 200, `read ${path}`);
    assert.equal(await act("write", path, "u1"), 403, `change ${path}`);
    assert.equal(await act("write", `${path}-new`, "u1"), 403, `create next to ${path}`);
    assert.equal(await act("delete", path, "u1"), 403, `delete ${path}`);
    for (const who of ["u2", null])
      assert.equal(await act("get", path, who), 403, `${who} reads ${path}`);
    assert.deepEqual((await db().doc(path).get()).data(), { x: "seeded" });
  }
});

test("the Polar link: the person reads whether it is connected, never writes it, and cannot read the newer-API tokens at all", async () => {
  await seed("users/u1/polar/connection");
  await seed("users/u1/polar/connection_v4");
  await seed("users/u1/polar/other");
  assert.equal(await act("get", "users/u1/polar/connection", "u1"), 200);
  assert.equal(await act("write", "users/u1/polar/connection", "u1"), 403);
  assert.equal(await act("delete", "users/u1/polar/connection", "u1"), 403);
  for (const doc of ["connection_v4", "other"]) {
    assert.equal(await act("get", `users/u1/polar/${doc}`, "u1"), 403, `read ${doc}`);
    assert.equal(await act("write", `users/u1/polar/${doc}`, "u1"), 403, `write ${doc}`);
    assert.equal(await act("delete", `users/u1/polar/${doc}`, "u1"), 403, `delete ${doc}`);
  }
  assert.equal(await act("get", "users/u1/polar", "u1"), 403); // listing would reveal the tokens' document
  for (const who of ["u2", null]) {
    for (const doc of ["connection", "connection_v4"]) {
      assert.equal(await act("get", `users/u1/polar/${doc}`, who), 403);
      assert.equal(await act("write", `users/u1/polar/${doc}`, who), 403);
    }
  }
});

test("everything not listed is closed: other top-level collections, unattributed usage, the list of users, unknown folders", async () => {
  await seed("ai_usage_unattributed/a1");
  await seed("somewhere/else");
  await seed("approvals/u1");
  await seed("users/u1/surprise/x");
  for (const who of ["u1", "u2", null]) {
    for (const path of [
      "ai_usage_unattributed/a1",
      "somewhere/else",
      "approvals/u1", // who may use Claude: only the server reads or writes it (Fix 134)
      "ai_usage_unattributed",
      "approvals",
      "users",
    ]) {
      assert.equal(await act("get", path, who), 403, `${who} reads ${path}`);
      assert.equal(
        await act("write", path.includes("/") ? path : `${path}/new`, who),
        403,
        `${who} writes ${path}`,
      );
    }
  }
  assert.equal(await act("get", "users/u1/surprise/x", "u1"), 403); // even the owner, in a folder the app does not use
  assert.equal(await act("write", "users/u1/surprise/x", "u1"), 403);
  assert.equal(await act("get", "users/u2", "u1"), 403);
  assert.equal(await act("write", "users/u2", "u1"), 403);
});

test("the server is not bound by the rules: it writes what arrives from devices and Claude", async () => {
  for (const path of [
    "users/u1/apple_activity/2026-10-01",
    "users/u1/ai_usage/c1",
    "users/u1/polar/connection_v4",
    "ai_usage_unattributed/a1",
  ]) {
    await db().doc(path).set({ server: true });
    assert.deepEqual((await db().doc(path).get()).data(), { server: true }, path);
  }
});

test("the rules file closes with a catch-all and the Storage rules allow only the person's own photo", async () => {
  const { readFileSync } = await import("node:fs");
  const fs = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  assert.match(fs, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  const st = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");
  assert.match(st, /profile-photos\/\{file\}/);
  assert.match(st, /file == request\.auth\.uid \+ "\.jpg"/);
  assert.match(st, /size < 20 \* 1024 \* 1024/);
  assert.match(st, /match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;/);
  const fb = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8"));
  assert.equal(fb.firestore.rules, "firestore.rules");
  assert.equal(fb.storage.rules, "storage.rules");
});
