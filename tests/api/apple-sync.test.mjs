// tests/api/apple-sync.test.mjs — POST /api/apple-sync against the Firestore emulator
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read } from "./setup.mjs";
import handler from "../../api/apple-sync.js";

const TOKEN = "test-token-123", UID = "user-1";
process.env.APPLE_SYNC_TOKEN = TOKEN;
process.env.APPLE_SYNC_USER_ID = UID;
const req = (body, token = TOKEN, method = "POST") => ({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body });
const call = async (r) => { const out = res(); await handler(r, out); return out; };
const doc = date => read(`users/${UID}/apple_activity/${date}`);

beforeEach(clearFirestore);

test("rejects non-POST, missing and wrong tokens", async () => {
  assert.equal((await call(req({}, TOKEN, "GET"))).statusCode, 405);
  assert.equal((await call(req({ date: "2026-10-01", steps: 1 }, null))).statusCode, 401);
  assert.equal((await call(req({ date: "2026-10-01", steps: 1 }, "wrong-token-12"))).statusCode, 401);
  assert.equal(await doc("2026-10-01"), undefined); // nothing written
});

test("daily totals are stored (and strings with units are tolerated)", async () => {
  const out = await call(req({ date: "2026-10-01", steps: "8,512 steps", active: 42, flights: "7" }));
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body.totals, { steps: 8512, activeMin: 42, flights: 7 });
  const d = await doc("2026-10-01");
  assert.equal(d.mode, "daily");
  assert.deepEqual(d.totals, { steps: 8512, activeMin: 42, flights: 7 });
  assert.equal(d.hourly, undefined);
});

test("each sync replaces the day's record", async () => {
  await call(req({ date: "2026-10-01", steps: 1000, active: 5, flights: 1 }));
  await call(req({ date: "2026-10-01", steps: 4000, active: 20, flights: 3 }));
  assert.deepEqual((await doc("2026-10-01")).totals, { steps: 4000, activeMin: 20, flights: 3 });
});

test("hourly steps are zipped with their start times (arrays or newline text)", async () => {
  await call(req({ date: "2026-10-01", steps: 3000, active: 10, flights: 2,
    hourly_steps: [812, 1540, 648], hourly_start: ["2026-10-01T07:57:00+01:00", "Oct 1, 2026 at 08:03", "01/10/2026, 13:30"] }));
  assert.deepEqual((await doc("2026-10-01")).hourly, { "07": 812, "08": 1540, "13": 648 });
  await call(req({ date: "2026-10-02", steps: 50, active: 0, flights: 0, hourly_steps: "20\n30", hourly_start: "2026-10-02 09:10\n2026-10-02 22:05" }));
  assert.deepEqual((await doc("2026-10-02")).hourly, { "09": 20, "22": 30 });
});

test("hourly entries from another day or mismatched lists are ignored", async () => {
  await call(req({ date: "2026-10-01", steps: 10, hourly_steps: [5, 7], hourly_start: ["2026-09-30T23:10:00", "2026-10-01T00:20:00"] }));
  assert.deepEqual((await doc("2026-10-01")).hourly, { "00": 7 });
  await call(req({ date: "2026-10-03", steps: 10, hourly_steps: [5, 7], hourly_start: ["2026-10-03T10:00:00"] }));
  assert.equal((await doc("2026-10-03")).hourly, undefined);
});

test("Shortcuts' date text is accepted; an unrecognised date is a 400 with nothing written", async () => {
  await call(req({ date: "Sep 26, 2026", steps: 100 }));
  assert.equal((await doc("2026-09-26")).totals.steps, 100);
  await call(req({ date: "27/09/2026", steps: 200 }));
  assert.equal((await doc("2026-09-27")).totals.steps, 200);
  const bad = await call(req({ date: "next tuesday", steps: 1 }));
  assert.equal(bad.statusCode, 400);
});

test("a JSON string body works; invalid JSON is a 400", async () => {
  const ok = await call(req(JSON.stringify({ date: "2026-10-01", steps: 9 })));
  assert.equal(ok.statusCode, 200);
  assert.equal((await doc("2026-10-01")).totals.steps, 9);
  assert.equal((await call(req("{not json"))).statusCode, 400);
});

test("timestamped samples go into 5-minute slots; Watch samples win over iPhone", async () => {
  const out = await call(req({ date: "2026-10-01",
    steps: [
      { s: "2026-10-01T08:00:00+01:00", e: "2026-10-01T08:05:00+01:00", v: 500, src: "Jiten's Apple Watch" },
      { s: "2026-10-01T08:00:00+01:00", e: "2026-10-01T08:05:00+01:00", v: 480, src: "Jiten's iPhone" },
    ],
    active: [{ s: "2026-10-01T08:00:00+01:00", e: "2026-10-01T08:05:00+01:00", v: 4, src: "Jiten's Apple Watch" }],
    flights: [] }));
  assert.equal(out.statusCode, 200);
  const d = await doc("2026-10-01");
  assert.equal(d.totals.steps, 500);            // iPhone duplicate dropped
  assert.equal(d.totals.activeMin, 4);
  const stepsInSlots = Object.values(d.slots).reduce((t, s) => t + s[0], 0);
  assert.equal(Math.round(stepsInSlots), 500);
  assert.ok(Object.keys(d.slots).every(k => /^\d{4}$/.test(k)));
});
