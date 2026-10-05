// tests/authProfile.test.mjs — the profile built at sign-up / Google sign-in and the sign-in
// pages' checks and messages (src/lib/authProfile.js, Fix 26 PR 35).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_LOGIN,
  EMPTY_SIGNUP,
  generateUID,
  memberSince,
  popupErrorMessage,
  profileFromGoogle,
  profileFromSignup,
  signInErrorMessage,
  signupErrorMessage,
  signupProblem,
} from "../src/lib/authProfile.js";

const FORM = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  password: "secret1",
  phone: "+44 1",
  address: "1 High St",
  city: "London",
  postcode: "SW1",
};

test("generateUID: USR- plus 9 upper-case letters / digits, different each time", () => {
  const a = generateUID();
  assert.match(a, /^USR-[A-Z0-9]{9}$/);
  assert.notEqual(a, generateUID());
});

test("memberSince: today as '4 October 2026'", () => {
  assert.match(memberSince(), /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  assert.equal(
    memberSince(),
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  );
});

test("profileFromSignup: every field but the password, a fresh uid, the account id, today", () => {
  const p = profileFromSignup(FORM, "fb-1");
  assert.deepEqual(Object.keys(p), [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "city",
    "postcode",
    "uid",
    "firebaseUid",
    "createdAt",
  ]);
  const { uid, createdAt, ...rest } = p;
  assert.deepEqual(rest, {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "+44 1",
    address: "1 High St",
    city: "London",
    postcode: "SW1",
    firebaseUid: "fb-1",
  });
  assert.match(uid, /^USR-/);
  assert.equal(createdAt, memberSince());
});

test("profileFromGoogle: first word → first name, the rest → last; blanks when nameless", () => {
  const p = profileFromGoogle({
    uid: "g",
    email: "g@example.com",
    displayName: "Gina Marie Google",
    photoURL: "https://p/x.jpg",
  });
  const { uid, createdAt, ...rest } = p;
  assert.deepEqual(rest, {
    firstName: "Gina",
    lastName: "Marie Google",
    email: "g@example.com",
    phone: "",
    address: "",
    city: "",
    postcode: "",
    photoURL: "https://p/x.jpg",
    firebaseUid: "g",
  });
  assert.match(uid, /^USR-/);
  assert.equal(createdAt, memberSince());
  const bare = profileFromGoogle({ uid: "g2", email: "e", displayName: null, photoURL: null });
  assert.deepEqual([bare.firstName, bare.lastName, bare.photoURL], ["", "", ""]);
  const one = profileFromGoogle({ uid: "g3", email: "e", displayName: "Cher" });
  assert.deepEqual([one.firstName, one.lastName], ["Cher", ""]);
});

test("signupProblem: the four required fields, then the password length", () => {
  assert.equal(signupProblem(FORM), null);
  for (const key of ["firstName", "lastName", "email", "password"])
    assert.equal(signupProblem({ ...FORM, [key]: "" }), "Please fill in all required fields.");
  assert.equal(signupProblem({ ...FORM, phone: "" }), null);
  assert.equal(
    signupProblem({ ...FORM, password: "12345" }),
    "Password must be at least 6 characters.",
  );
  assert.equal(signupProblem({ ...FORM, password: "123456" }), null);
});

test("error messages: the known codes get a friendly line, the rest Firebase's own", () => {
  const err = (code) => Object.assign(new Error(`Firebase: ${code}`), { code });
  assert.equal(
    signupErrorMessage(err("auth/email-already-in-use")),
    "An account with this email already exists.",
  );
  assert.equal(signupErrorMessage(err("auth/weak-password")), "Firebase: auth/weak-password");
  assert.equal(signInErrorMessage(err("auth/invalid-credential")), "Invalid email or password.");
  assert.equal(signInErrorMessage(err("auth/x")), "Firebase: auth/x");
  assert.equal(popupErrorMessage(err("auth/popup-closed-by-user")), "");
  assert.equal(popupErrorMessage(err("auth/network")), "Firebase: auth/network");
});

test("the empty forms", () => {
  assert.deepEqual(EMPTY_SIGNUP, {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: "",
    postcode: "",
  });
  assert.deepEqual(EMPTY_LOGIN, { email: "", password: "" });
});
