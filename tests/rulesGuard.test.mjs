// tests/rulesGuard.test.mjs — the reader of firestore.rules and storage.rules that the UI harness
// uses (Fix 124): what it makes of the real files, and of rule texts written to try it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  firestoreAllows,
  parseFirestoreRules,
  parseStorageRules,
  storageAllowsAccess,
  storageAllowsUpload,
} from "../tests/ui/harness/rulesGuard.js";

const REAL = parseFirestoreRules(
  readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
);
const ok = (op, path, parsed = REAL) => firestoreAllows(parsed, op, path).ok;

test("the real firestore.rules: the collections the app keeps are read and write, as the file says", () => {
  for (const col of [
    "nutrition_days",
    "recipes",
    "weight_log",
    "body_log",
    "weight_plan",
    "monthly_targets",
    "routine_log",
    "settings",
    "claude_chat",
    "polar_sessions",
  ]) {
    for (const op of ["get", "list", "create", "update", "delete"]) {
      assert.equal(ok(op, `users/u/${col}/d`), true, `${op} ${col}`);
    }
  }
  assert.deepEqual(Object.keys(REAL.collections).sort(), [
    "ai_usage",
    "app_errors",
    "apple_activity",
    "body_log",
    "claude_chat",
    "monthly_targets",
    "nutrition_days",
    "polar",
    "polar_sessions",
    "recipes",
    "routine_log",
    "settings",
    "weight_log",
    "weight_plan",
  ]);
});

test("the real firestore.rules: the profile, the error log, the server's records and the Polar link", () => {
  for (const op of ["get", "update", "create", "delete"])
    assert.equal(ok(op, "users/u"), true, `profile ${op}`);
  assert.equal(ok("create", "users/u/app_errors/e"), true);
  assert.equal(ok("list", "users/u/app_errors"), true);
  for (const op of ["update", "delete"])
    assert.equal(ok(op, "users/u/app_errors/e"), false, `error log ${op}`);
  for (const col of ["apple_activity", "ai_usage"]) {
    assert.equal(ok("get", `users/u/${col}/d`), true);
    assert.equal(ok("list", `users/u/${col}`), true);
    for (const op of ["create", "update", "delete"])
      assert.equal(ok(op, `users/u/${col}/d`), false, `${col} ${op}`);
  }
  assert.equal(ok("get", "users/u/polar/connection"), true);
  for (const op of ["create", "update", "delete"])
    assert.equal(ok(op, "users/u/polar/connection"), false);
  assert.equal(ok("get", "users/u/polar/connection_v4"), false); // only the one document may be read
  assert.equal(ok("get", "users/u/polar/other"), false);
  assert.equal(ok("list", "users/u/polar"), false);
});

test("the real firestore.rules: anything not listed is closed", () => {
  assert.deepEqual(firestoreAllows(REAL, "get", "users/u/surprise/x"), {
    ok: false,
    why: 'no rule for "surprise"',
  });
  assert.equal(firestoreAllows(REAL, "get", "somewhere/else").why, "not under users/{uid}");
  assert.equal(firestoreAllows(REAL, "get", "users").why, "not under users/{uid}");
  assert.equal(firestoreAllows(REAL, "get", "ai_usage_unattributed/a").ok, false);
  assert.equal(firestoreAllows(REAL, "get", "").ok, false);
  assert.equal(firestoreAllows(REAL, "get", undefined).ok, false);
  assert.equal(firestoreAllows(REAL, "get", "users/u/recipes/r").why, "");
  assert.equal(
    firestoreAllows(REAL, "delete", "users/u/ai_usage/c").why,
    'the rules do not allow this on "ai_usage"',
  );
  assert.equal(firestoreAllows(REAL, "delete", "users/u").ok, true);
});

const TRY = `
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if owner(uid);   // only reading the profile
      match /notes/{doc} { allow read, write: if owner(uid); }
      match /logs/{doc} { allow read, create: if owner(uid); }
      match /secret/{doc} {
        // allow read, write: if true;   (this one is commented out)
        allow read: if owner(uid) && doc == "visible";
        allow update: if owner(uid) && doc == "visible";
      }
      match /sub/{doc} { allow get: if owner(uid); allow list, delete: if owner(uid); }
    }
    match /everything/{x} { allow read, write: if true; }
  }
}`;

test("a rule text written to try the reader: operations, comments, one-document limits, and nothing outside users", () => {
  const t = parseFirestoreRules(TRY);
  assert.equal(ok("get", "users/u", t), true);
  assert.equal(ok("update", "users/u", t), false); // the profile is read-only here
  assert.equal(ok("create", "users/u/notes/n", t), true);
  assert.equal(ok("update", "users/u/logs/l", t), false);
  assert.equal(ok("create", "users/u/logs/l", t), true);
  assert.equal(ok("get", "users/u/secret/visible", t), true);
  assert.equal(ok("get", "users/u/secret/hidden", t), false);
  assert.equal(ok("update", "users/u/secret/visible", t), true);
  assert.equal(ok("update", "users/u/secret/hidden", t), false);
  assert.equal(ok("create", "users/u/secret/visible", t), false); // not in the allow list
  assert.equal(ok("get", "users/u/sub/s", t), true); // get, then list and delete on a later line
  assert.equal(ok("delete", "users/u/sub/s", t), true);
  assert.equal(ok("create", "users/u/sub/s", t), false);
  assert.equal(ok("get", "everything/x", t), false); // outside users
});

test("rules with no users block, or an empty text, allow nothing", () => {
  for (const text of [
    "",
    "service cloud.firestore {}",
    "match /other/{x} { allow read: if true; }",
  ]) {
    const t = parseFirestoreRules(text);
    assert.deepEqual(t, { profile: [], collections: {} });
    assert.equal(ok("get", "users/u", t), false);
    assert.equal(ok("get", "users/u/recipes/r", t), false);
  }
});

test("an allow line that is not an allow, or is damaged, adds nothing", () => {
  const t = parseFirestoreRules(
    "match /users/{uid} { match /a/{d} { allow read if true; } match /b/{d} { allow : if true; } }",
  );
  assert.deepEqual(t.collections, { a: [], b: [] });
});

const STORAGE = parseStorageRules(
  readFileSync(new URL("../storage.rules", import.meta.url), "utf8"),
);

test("the real storage.rules: one folder, 20 MB, an image", () => {
  assert.deepEqual(STORAGE, { folders: ["profile-photos"], maxBytes: 20 * 1024 * 1024 });
  const up = (path, file) => storageAllowsUpload(STORAGE, path, file);
  assert.equal(up("profile-photos/u.jpg", { size: 1000, type: "image/jpeg" }).ok, true);
  assert.equal(
    up("profile-photos/u.jpg", { size: 20 * 1024 * 1024 - 1, type: "image/heic" }).ok,
    true,
  );
  assert.equal(
    up("profile-photos/u.jpg", { size: 20 * 1024 * 1024, type: "image/jpeg" }).why,
    "larger than the rules allow",
  );
  assert.equal(
    up("profile-photos/u.jpg", { size: 1000, type: "application/pdf" }).why,
    "not an image",
  );
  assert.equal(up("profile-photos/u.jpg", { size: 1000 }).why, "not an image");
  assert.equal(up("profile-photos/u.jpg", undefined).why, "not an image");
  for (const path of [
    "videos/u.mp4",
    "profile-photos",
    "profile-photos/",
    "profile-photos/a/b.jpg",
    "",
    undefined,
  ]) {
    assert.equal(up(path, { size: 1, type: "image/png" }).ok, false, String(path));
  }
  assert.equal(
    up("other/u.jpg", { size: 1, type: "image/png" }).why,
    'no Storage rule for "other/u.jpg"',
  );
  assert.equal(storageAllowsAccess(STORAGE, "profile-photos/u.jpg").ok, true);
  assert.equal(storageAllowsAccess(STORAGE, "profile-photos/a/b").ok, false);
  assert.equal(
    storageAllowsAccess(STORAGE, "videos/u.mp4").why,
    'no Storage rule for "videos/u.mp4"',
  );
});

test("storage rules written to try the reader: several folders, no size limit, comments", () => {
  const t = parseStorageRules(`
    match /b/{bucket}/o {
      // match /old/{file} { }
      match /photos/{file} { allow write: if true; }
      match /docs-2/{file} { allow write: if request.resource.size < 3 * 1024 * 1024; }
    }`);
  assert.deepEqual(t.folders, ["photos", "docs-2"]);
  assert.equal(t.maxBytes, 3 * 1024 * 1024);
  assert.equal(parseStorageRules("").maxBytes, Infinity);
  assert.deepEqual(parseStorageRules("").folders, []);
  assert.equal(
    storageAllowsUpload(parseStorageRules("match /p/{file} {}"), "p/x.jpg", {
      size: 1e12,
      type: "image/png",
    }).ok,
    true,
  );
});
