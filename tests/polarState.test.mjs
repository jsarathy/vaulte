// tests/polarState.test.mjs — the signed OAuth state for Polar's sign-in (Fix 120): made for one
// user, valid ten minutes, impossible to make or change without the server's secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readState, signState } from "../api/_polar/state.js";

const SECRET = "polar-client-secret";
const NOW = 1_800_000_000_000;
const TEN_MIN = 10 * 60 * 1000;
const b64 = (x) => Buffer.from(x).toString("base64url");
const parts = (state) => state.split(".");
const claimsOf = (state) => JSON.parse(Buffer.from(parts(state)[0], "base64url").toString());
/** A state signed the way the server does, for claims chosen by the test. */
const forge = (claims, secret = SECRET) => {
  const payload = b64(JSON.stringify(claims));
  const mac = crypto.createHmac("sha256", `vaulte-polar-state:${secret}`).update(payload).digest();
  return `${payload}.${b64(mac)}`;
};

test("signState: a state for the user, expiring in ten minutes; the v is there only when asked for", () => {
  assert.deepEqual(claimsOf(signState({ uid: "u1" }, SECRET, NOW)), {
    uid: "u1",
    exp: NOW + TEN_MIN,
  });
  assert.deepEqual(claimsOf(signState({ uid: "u1", v: 4 }, SECRET, NOW)), {
    uid: "u1",
    v: 4,
    exp: NOW + TEN_MIN,
  });
  assert.deepEqual(claimsOf(signState({ uid: "u1", v: undefined }, SECRET, NOW)), {
    uid: "u1",
    exp: NOW + TEN_MIN,
  });
  const state = signState({ uid: "u1" }, SECRET, NOW);
  assert.equal(parts(state).length, 2);
  assert.match(state, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // safe in a URL as it is
});

test("signState: no secret, no state", () => {
  for (const none of [undefined, null, ""]) {
    assert.throws(() => signState({ uid: "u1" }, none, NOW), /No secret/);
  }
});

test("readState: the user (and v) of a state this server signed", () => {
  assert.deepEqual(readState(signState({ uid: "u1" }, SECRET, NOW), SECRET, NOW + 1000), {
    uid: "u1",
    v: undefined,
  });
  assert.deepEqual(readState(signState({ uid: "u1", v: 4 }, SECRET, NOW), SECRET, NOW + 1000), {
    uid: "u1",
    v: 4,
  });
});

test("readState: valid up to and including the expiry time, expired after it", () => {
  const state = signState({ uid: "u1" }, SECRET, NOW);
  assert.equal(readState(state, SECRET, NOW + TEN_MIN).uid, "u1");
  assert.deepEqual(readState(state, SECRET, NOW + TEN_MIN + 1), { error: "state_expired" });
});

test("readState: a state made without the secret, or with another, is bad", () => {
  const claims = { uid: "victim", exp: NOW + TEN_MIN };
  assert.deepEqual(readState(forge(claims, "guess"), SECRET, NOW), { error: "bad_state" });
  assert.deepEqual(readState(forge(claims, SECRET), SECRET, NOW), { uid: "victim", v: undefined }); // the real thing
  assert.deepEqual(readState(`${b64(JSON.stringify(claims))}.`, SECRET, NOW), {
    error: "bad_state",
  }); // no signature
  assert.deepEqual(readState(b64(JSON.stringify(claims)), SECRET, NOW), { error: "bad_state" }); // the old unsigned form
  assert.deepEqual(readState(`${b64(JSON.stringify(claims))}.AAAA`, SECRET, NOW), {
    error: "bad_state",
  });
});

test("readState: changing the user, the expiry or the version of a signed state breaks it", () => {
  const state = signState({ uid: "u1" }, SECRET, NOW);
  const [, signature] = parts(state);
  for (const changed of [
    { uid: "victim", exp: NOW + TEN_MIN },
    { uid: "u1", exp: NOW + 99 * TEN_MIN },
    { uid: "u1", v: 4, exp: NOW + TEN_MIN },
  ]) {
    assert.deepEqual(readState(`${b64(JSON.stringify(changed))}.${signature}`, SECRET, NOW), {
      error: "bad_state",
    });
  }
  // a signature taken from another state does not fit this one
  const other = signState({ uid: "u2" }, SECRET, NOW);
  assert.deepEqual(readState(`${parts(state)[0]}.${parts(other)[1]}`, SECRET, NOW), {
    error: "bad_state",
  });
});

test("readState: signed but meaningless claims are bad (no user, not a string, empty, no or odd expiry)", () => {
  for (const claims of [
    { exp: NOW + 1 },
    { uid: 5, exp: NOW + 1 },
    { uid: "", exp: NOW + 1 },
    null,
    "text",
    7,
  ]) {
    assert.deepEqual(
      readState(forge(claims), SECRET, NOW),
      { error: "bad_state" },
      JSON.stringify(claims),
    );
  }
  assert.deepEqual(readState(forge({ uid: "u1" }), SECRET, NOW), { error: "state_expired" }); // no expiry: not live
  assert.deepEqual(readState(forge({ uid: "u1", exp: "soon" }), SECRET, NOW), {
    error: "state_expired",
  });
  assert.deepEqual(readState(forge({ uid: "u1", exp: NOW }), SECRET, NOW), {
    uid: "u1",
    v: undefined,
  }); // exactly now: still live
});

test("readState: rubbish, empty, extra dots and no secret are bad", () => {
  const good = signState({ uid: "u1" }, SECRET, NOW);
  for (const state of [
    undefined,
    null,
    "",
    ".",
    "a.b",
    "not a state",
    `${good}.x`,
    `.${parts(good)[1]}`,
    `${parts(good)[0]}.`,
    42,
  ]) {
    assert.deepEqual(readState(state, SECRET, NOW), { error: "bad_state" }, String(state));
  }
  for (const none of [undefined, null, ""]) {
    assert.deepEqual(readState(good, none, NOW), { error: "bad_state" }); // never "valid" under an empty secret
    assert.deepEqual(readState(forge({ uid: "u1", exp: NOW + 1 }, "undefined"), none, NOW), {
      error: "bad_state",
    });
  }
  assert.deepEqual(readState(`${parts(good)[0]}.${b64("x".repeat(100))}`, SECRET, NOW), {
    error: "bad_state",
  }); // wrong length
});

test("readState: a payload that is signed but is not JSON is bad", () => {
  const payload = b64("this is not json");
  const mac = crypto.createHmac("sha256", `vaulte-polar-state:${SECRET}`).update(payload).digest();
  assert.deepEqual(readState(`${payload}.${b64(mac)}`, SECRET, NOW), { error: "bad_state" });
});

test("readState: an expiry that is a number written as text does not count", () => {
  const text = String(NOW + 60_000); // a string compares as a number in a plain >=
  assert.deepEqual(readState(forge({ uid: "u1", exp: text }), SECRET, NOW), {
    error: "state_expired",
  });
  assert.deepEqual(readState(forge({ uid: "u1", exp: NOW + 60_000 }), SECRET, NOW), {
    uid: "u1",
    v: undefined,
  });
});
