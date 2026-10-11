// tests/polarClientSamples.test.mjs — api/_polar client, samples and sessions, and api/_renpho/client:
// what they log and how they behave on missing or odd replies (no Firestore, no network).
// Cases the mutation run (Fix 81) showed unguarded.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { polarClient } from "../api/_polar/client.js";
import { fetchHrSamples, hrFromSampleSets } from "../api/_polar/samples.js";
import { fetchSessions, fillMissingHr } from "../api/_polar/sessions.js";
import { checkResponse, decryptResponse, encryptRequest } from "../api/_renpho/client.js";

const realFetch = globalThis.fetch;
beforeEach(() => {
  mock.method(console, "warn", () => {});
});
afterEach(() => {
  globalThis.fetch = realFetch;
  mock.restoreAll();
});
const NO_HR = { hr_samples: null, recording_rate_s: null };
const said = () => console.warn.mock.calls.map((c) => c.arguments);

test("polarClient: an exercise list without exercises is empty, a failed one is null", async () => {
  const client = polarClient({ access_token: "t", polar_user_id: "7" });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  assert.deepEqual(await client.listExercises("tx"), []);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ exercises: ["a"] }) });
  assert.deepEqual(await client.listExercises("tx"), ["a"]);
  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await client.listExercises("tx"), null);
});

test("hrFromSampleSets: heart rate comes from sample type 0; no set, or one without data, is no heart rate", () => {
  assert.deepEqual(
    hrFromSampleSets([{ "sample-type": "0", data: "0,60,70", "recording-rate": 1 }]),
    {
      hr_samples: [60, 70],
      recording_rate_s: 1,
    },
  );
  assert.deepEqual(hrFromSampleSets([{ "sample-type": 0, data: "60,70" }]).recording_rate_s, 5);
  assert.deepEqual(hrFromSampleSets([{ "sample-type": "0" }]), NO_HR); // a heart-rate set with no data
  assert.deepEqual(hrFromSampleSets([{ "sample-type": "1", data: "1,2" }]), NO_HR); // not heart rate
  assert.deepEqual(hrFromSampleSets(undefined), NO_HR);
  assert.deepEqual(hrFromSampleSets([]), NO_HR);
});

test("fetchHrSamples: a refused or failed fetch gives no heart rate, and a failure is logged", async () => {
  globalThis.fetch = async () => ({ ok: false });
  assert.deepEqual(await fetchHrSamples("https://p/ex/1", {}), NO_HR);
  globalThis.fetch = async () => {
    throw new Error("socket hang up");
  };
  assert.deepEqual(await fetchHrSamples("https://p/ex/1", {}), NO_HR);
  assert.deepEqual(said(), [["HR samples fetch failed for:", "https://p/ex/1", "socket hang up"]]);
});

test("fetchSessions: a session that cannot be fetched is skipped and logged with its address and error", async () => {
  const boom = new Error("reset");
  globalThis.fetch = async () => {
    throw boom;
  };
  assert.deepEqual(await fetchSessions(["https://p/ex/9"], { auth: {}, polar_user_id: "7" }), []);
  assert.deepEqual(said(), [["Failed to fetch exercise:", "https://p/ex/9", boom]]);
});

test("fillMissingHr: sessions that all have heart rate are left alone; a failed list is logged and changes nothing", async () => {
  const withHr = [{ id: "1", hr_samples: [60] }];
  assert.equal(await fillMissingHr(withHr, {}, "7"), withHr);
  const without = [{ id: "2", hr_samples: null, start_time: "2026-09-03T08:00:00" }];
  globalThis.fetch = async () => {
    throw new Error("list is down");
  };
  const out = await fillMissingHr(without, { Authorization: "x" }, "7");
  assert.equal(out[0].hr_samples, null); // nothing changed
  assert.equal(out[0].id, "2");
});

test("renpho: a request survives encrypting and decrypting, and is base64 on the wire", () => {
  const payload = { email: "a@b.c", n: [1, 2, 3], nested: { ok: true } };
  const { encryptData } = encryptRequest(payload);
  assert.match(encryptData, /^[A-Za-z0-9+/]+=*$/);
  assert.deepEqual(decryptResponse(encryptData), payload);
});

test("renpho: checkResponse accepts success by message or code, and names a missing reply in its error", () => {
  assert.doesNotThrow(() => checkResponse({ msg: "Success" }, "X"));
  assert.doesNotThrow(() => checkResponse({ code: "101" }, "X"));
  assert.doesNotThrow(() => checkResponse({ code: 20000 }, "X"));
  assert.throws(
    () => checkResponse({ code: 500, msg: "bad" }, "Login"),
    /Login failed: code=500, msg=bad/,
  );
  assert.throws(() => checkResponse(undefined, "Login"), /Login failed: code=undefined, msg=$/);
  assert.throws(
    () => checkResponse({}, "Girth page 1"),
    /Girth page 1 failed: code=undefined, msg=/,
  );
});
