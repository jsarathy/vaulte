// tests/authHistory.test.mjs — which browser-history entry stands for which sign-in page, and
// what Back / Forward do (src/lib/authHistory.js, Fix 53).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backTarget,
  entryFor,
  historyAction,
  isAuthPage,
  pageOfEntry,
} from "../src/lib/authHistory.js";

test("the sign-in pages are landing, signup and login — nothing else", () => {
  for (const p of ["landing", "signup", "login"]) assert.equal(isAuthPage(p), true, p);
  for (const p of ["account", "loading", "", undefined, null]) assert.equal(isAuthPage(p), false);
});

test("an entry stands for a sign-in page only when it was written by entryFor", () => {
  assert.deepEqual(entryFor("login"), { vaultePage: "login" });
  for (const p of ["landing", "signup", "login"]) assert.equal(pageOfEntry(entryFor(p)), p);
  for (const s of [null, undefined, {}, { vaultePage: "account" }, { vaultePage: "x" }, "login"])
    assert.equal(pageOfEntry(s), null);
});

test("a page change adds an entry, replaces a foreign one, or does nothing", () => {
  assert.equal(historyAction(null, "landing"), "replace"); // the first visit
  assert.equal(historyAction({}, "landing"), "replace"); // e.g. after a sign-in link return
  assert.equal(historyAction(entryFor("landing"), "signup"), "push");
  assert.equal(historyAction(entryFor("signup"), "login"), "push");
  assert.equal(historyAction(entryFor("signup"), "signup"), "none"); // Back / Forward landed here
  for (const cur of [null, entryFor("login")]) {
    assert.equal(historyAction(cur, "account"), "none"); // the signed-in pages are untouched
    assert.equal(historyAction(cur, "loading"), "none");
  }
});

test("Back / Forward switch sign-in pages; while loading or signed in they do nothing", () => {
  assert.equal(backTarget("signup", entryFor("landing")), "landing");
  assert.equal(backTarget("landing", entryFor("login")), "login");
  assert.equal(backTarget("login", null), "landing"); // an entry from before the app wrote any
  assert.equal(backTarget("login", {}), "landing");
  assert.equal(backTarget("account", entryFor("login")), null);
  assert.equal(backTarget("loading", entryFor("login")), null);
});
