// tests/confirmGate.test.mjs — who has to confirm an email address before using the app (Fix 130).
import test from "node:test";
import assert from "node:assert/strict";
import { needsConfirmation } from "../src/lib/confirmGate.js";

const password = [{ providerId: "password" }];
const google = [{ providerId: "google.com" }];

test("a password account with an unconfirmed address must confirm", () => {
  assert.equal(needsConfirmation({ emailVerified: false, providerData: password }), true);
  assert.equal(needsConfirmation({ providerData: password }), true); // not stated: not confirmed
});

test("a confirmed password account does not", () => {
  assert.equal(needsConfirmation({ emailVerified: true, providerData: password }), false);
});

test("Google and other sign-ins do not, confirmed or not", () => {
  assert.equal(needsConfirmation({ emailVerified: false, providerData: google }), false);
  assert.equal(needsConfirmation({ emailVerified: false, providerData: [] }), false);
  assert.equal(needsConfirmation({ emailVerified: false }), false);
});

test("nobody signed in: nothing to confirm", () => {
  assert.equal(needsConfirmation(null), false);
  assert.equal(needsConfirmation(undefined), false);
});

test("an account with both a password and Google must confirm while unconfirmed", () => {
  const both = [...google, ...password];
  assert.equal(needsConfirmation({ emailVerified: false, providerData: both }), true);
});
