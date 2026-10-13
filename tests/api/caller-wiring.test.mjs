// tests/api/caller-wiring.test.mjs — every function that acts for a signed-in person checks the
// caller with the real verifyIdToken (Google's signing keys) unless a test replaces it. This file
// runs in its own process, so it sees the defaults the other test files overwrite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyIdToken } from "../../api/_admin/verify.js";
import { accessOf } from "../../api/_admin/access.js";
import { deps as claude } from "../../api/claude.js";
import { deps as polarSync } from "../../api/polar-sync.js";
import { deps as polarFetchHr } from "../../api/polar-fetch-hr.js";
import { deps as polarDisconnect } from "../../api/polar-disconnect.js";
import { deps as renphoSync } from "../../api/renpho-sync.js";

test("the five functions verify the caller with the real verifyIdToken", () => {
  const all = { claude, polarSync, polarFetchHr, polarDisconnect, renphoSync };
  for (const [name, deps] of Object.entries(all)) {
    assert.equal(deps.verify, verifyIdToken, name);
  }
});

test("the proxy checks approval with the real accessOf unless a test replaces it (Fix 134)", () => {
  assert.equal(claude.access, accessOf);
});
