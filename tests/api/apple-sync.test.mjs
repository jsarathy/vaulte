// tests/api/apple-sync.test.mjs — POST /api/apple-sync against the Firestore emulator
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { res, clearFirestore, read } from "./setup.mjs";
import handler from "../../api/apple-sync.js";

const TOKEN = "test-token-123",
  UID = "user-1";
process.env.APPLE_SYNC_TOKEN = TOKEN;
process.env.APPLE_SYNC_USER_ID = UID;
const req = (body, token = TOKEN, method = "POST") => ({
  method,
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
});
const call = async (r) => {
  const out = res();
  await handler(r, out);
  return out;
};
const doc = (date) => read(`users/${UID}/apple_activity/${date}`);

beforeEach(clearFirestore);

test("rejects non-POST, missing and wrong tokens", async () => {
  assert.equal((await call(req({}, TOKEN, "GET"))).statusCode, 405);
  assert.equal((await call(req({ date: "2026-10-01", steps: 1 }, null))).statusCode, 401);
  assert.equal(
    (await call(req({ date: "2026-10-01", steps: 1 }, "wrong-token-12"))).statusCode,
    401,
  );
  assert.equal((await call(req({ date: "2026-10-01" }, `${TOKEN}-longer`))).statusCode, 401);
  assert.equal((await call(req({ date: "2026-10-01" }, TOKEN, "PUT"))).statusCode, 405);
  assert.equal(await doc("2026-10-01"), undefined); // nothing written
});

test("daily totals are stored (and strings with units are tolerated)", async () => {
  const out = await call(
    req({ date: "2026-10-01", steps: "8,512 steps", active: 42, flights: "7" }),
  );
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
  const out = await call(
    req({
      date: "2026-10-01",
      steps: 3000,
      active: 10,
      flights: 2,
      hourly_steps: [812, 1540, 648],
      hourly_start: ["2026-10-01T07:57:00+01:00", "Oct 1, 2026 at 08:03", "01/10/2026, 13:30"],
    }),
  );
  assert.deepEqual((await doc("2026-10-01")).hourly, { "07": 812, "08": 1540, 13: 648 });
  assert.equal(out.body.hourly_hours, 3);
  await call(
    req({
      date: "2026-10-02",
      steps: 50,
      active: 0,
      flights: 0,
      hourly_steps: "20\n30\n",
      hourly_start: "2026-10-02 09:10\n\n2026-10-02 22:05\n",
    }),
  );
  assert.deepEqual((await doc("2026-10-02")).hourly, { "09": 20, 22: 30 });
});

test("hourly entries from another day or mismatched lists are ignored", async () => {
  await call(
    req({
      date: "2026-10-01",
      steps: 10,
      hourly_steps: [5, 7],
      hourly_start: ["2026-09-30T23:10:00", "2026-10-01T00:20:00"],
    }),
  );
  assert.deepEqual((await doc("2026-10-01")).hourly, { "00": 7 });
  await call(
    req({
      date: "2026-10-03",
      steps: 10,
      hourly_steps: [5, 7],
      hourly_start: ["2026-10-03T10:00:00"],
    }),
  );
  assert.equal((await doc("2026-10-03")).hourly, undefined);
});

test("Shortcuts' date text is accepted; an unrecognised date is a 400 with nothing written", async () => {
  await call(req({ date: "Sep 26, 2026", steps: 100 }));
  assert.equal((await doc("2026-09-26")).totals.steps, 100);
  await call(req({ date: "27/09/2026", steps: 200 }));
  assert.equal((await doc("2026-09-27")).totals.steps, 200);
  const bad = await call(req({ date: "next tuesday", steps: 1 }));
  assert.equal(bad.statusCode, 400);
  assert.equal((await call(req({ date: "Xyz 3, 2026", steps: 1 }))).statusCode, 400);
});

test("a JSON string body works; invalid JSON is a 400", async () => {
  const ok = await call(req(JSON.stringify({ date: "2026-10-01", steps: 9 })));
  assert.equal(ok.statusCode, 200);
  assert.equal((await doc("2026-10-01")).totals.steps, 9);
  assert.equal((await call(req("{not json"))).statusCode, 400);
});

test("timestamped samples go into 5-minute slots; Watch samples win over iPhone", async () => {
  const out = await call(
    req({
      date: "2026-10-01",
      steps: [
        {
          s: "2026-10-01T08:00:00+01:00",
          e: "2026-10-01T08:05:00+01:00",
          v: 500,
          src: "Jiten's Apple Watch",
        },
        {
          s: "2026-10-01T08:00:00+01:00",
          e: "2026-10-01T08:05:00+01:00",
          v: 480,
          src: "Jiten's iPhone",
        },
      ],
      active: [
        {
          s: "2026-10-01T08:00:00+01:00",
          e: "2026-10-01T08:05:00+01:00",
          v: 4,
          src: "Jiten's Apple Watch",
        },
      ],
      flights: [],
    }),
  );
  assert.equal(out.statusCode, 200);
  const d = await doc("2026-10-01");
  assert.equal(d.totals.steps, 500); // iPhone duplicate dropped
  assert.equal(d.totals.activeMin, 4);
  const stepsInSlots = Object.values(d.slots).reduce((t, s) => t + s[0], 0);
  assert.equal(Math.round(stepsInSlots), 500);
  assert.ok(Object.keys(d.slots).every((k) => /^\d{4}$/.test(k)));
});

// ---- Fix 26 PR 33: behaviour pinned before the split into api/_apple/* ----

const W = "Apple Watch";
const smp = (s, e, v, src = W) => ({ s, e, v, src });
const sample = (date, steps, extra = {}) => req({ date, steps, active: [], flights: [], ...extra });
const todayUK = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

test("a missing APPLE_SYNC_USER_ID is a 500; a bad one is a 500 'Firestore write failed'", async () => {
  const saved = process.env.APPLE_SYNC_USER_ID;
  delete process.env.APPLE_SYNC_USER_ID;
  const out = await call(req({ date: "2026-10-01", steps: 1 }));
  assert.equal(out.statusCode, 500);
  assert.match(out.body.error, /APPLE_SYNC_USER_ID/);
  process.env.APPLE_SYNC_USER_ID = "odd/path"; // users/odd/path/apple_activity/<date> is not a document
  const daily = await call(req({ date: "2026-10-01", steps: 1 }));
  assert.deepEqual([daily.statusCode, daily.body], [500, { error: "Firestore write failed" }]);
  const slotted = await call(
    sample("2026-10-01", [smp("2026-10-01T08:00", "2026-10-01T08:05", 10)]),
  );
  assert.deepEqual([slotted.statusCode, slotted.body], [500, { error: "Firestore write failed" }]);
  process.env.APPLE_SYNC_USER_ID = saved;
  assert.equal(await doc("2026-10-01"), undefined);
});

test("a Buffer body is parsed; a body with no date lands on today (UK)", async () => {
  const out = await call(req(Buffer.from(JSON.stringify({ steps: 77, active: 3, flights: 1 }))));
  assert.equal(out.statusCode, 200);
  assert.equal(out.body.date, todayUK());
  const d = await doc(todayUK());
  assert.deepEqual(d.totals, { steps: 77, activeMin: 3, flights: 1 });
  assert.equal(d.date, todayUK());
  assert.match(d.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const none = await call(req(undefined)); // no body at all
  assert.deepEqual(
    [none.statusCode, none.body.totals],
    [200, { steps: 0, activeMin: 0, flights: 0 }],
  );
});

test("daily mode: the date is the first YYYY-MM-DD in the value; units and blanks are tolerated", async () => {
  const out = await call(
    req({
      date: "Synced 2026-10-04T23:59:00+01:00",
      steps: "1,234.6 steps",
      active: "",
      flights: "1-2",
    }),
  );
  assert.equal(out.body.date, "2026-10-04");
  assert.deepEqual(out.body.totals, { steps: 1235, activeMin: 0, flights: 0 });
  assert.equal(out.body.hourly_hours, 0);
  assert.deepEqual((await doc("2026-10-04")).totals, { steps: 1235, activeMin: 0, flights: 0 });
});

test("daily mode: Shortcuts' date text forms, 12-hour clocks, and a date with no time", async () => {
  await call(req({ date: "27 Sep 2026 at 07:00", steps: 1 }));
  assert.equal((await doc("2026-09-27")).totals.steps, 1);
  await call(req({ date: "Sept. 3, 2026", steps: 2 }));
  assert.equal((await doc("2026-09-03")).totals.steps, 2);
  const hours = (date, starts) =>
    call(req({ date, steps: 1, hourly_steps: starts.map((_, i) => i + 1), hourly_start: starts }));
  await hours("2026-10-01", [
    "Oct 1, 2026 at 12:00 AM",
    "Oct 1, 2026 at 1:30 PM",
    "Oct 1, 2026 at 12:05 PM",
    "1 Oct 2026 at 11:59 PM",
    "01/10/2026, 07:15",
  ]);
  assert.deepEqual((await doc("2026-10-01")).hourly, { "00": 1, 13: 2, 12: 3, 23: 4, "07": 5 });
  await hours("2026-10-02", ["Oct 2, 2026", "2 October 2026 at 9"]); // no usable time
  assert.equal((await doc("2026-10-02")).hourly, undefined);
});

test("hourly steps: units stripped, same hour summed, zero/negative/non-numeric dropped, rounded", async () => {
  await call(
    req({
      date: "2026-10-01",
      steps: 1,
      hourly_steps: ["812 steps", "100.4", "0", "-5", "abc", "7.6", "12"],
      hourly_start: [
        "2026-10-01T07:57:00+01:00",
        "2026-10-01T07:03:00+01:00",
        "2026-10-01T08:00:00+01:00",
        "2026-10-01T09:00:00+01:00",
        "2026-10-01T10:00:00+01:00",
        "2026-10-01T11:00:00+01:00",
        "2026-10-02T11:00:00+01:00",
      ],
    }),
  );
  const d = await doc("2026-10-01");
  assert.deepEqual(d.hourly, { "07": 912, 11: 8 });
  assert.equal(d.mode, "daily");
  await call(req({ date: "2026-10-03", steps: 1, hourly_steps: "", hourly_start: "" }));
  assert.equal((await doc("2026-10-03")).hourly, undefined);
});

test("sample mode: values are spread pro-rata over the 5-minute slots they overlap", async () => {
  const out = await call(
    sample("2026-10-01", [smp("2026-10-01T08:02:30+01:00", "2026-10-01T08:12:30+01:00", 100)], {
      active: [smp("2026-10-01T08:00", "2026-10-01T08:03", 3)],
      flights: [smp("2026-10-01T08:04:00", "2026-10-01T08:04:00", 2)],
    }),
  );
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body, {
    ok: true,
    date: "2026-10-01",
    slots: 3,
    totals: { steps: 100, activeMin: 3, flights: 2 },
  });
  const d = await doc("2026-10-01");
  assert.deepEqual(d.slots, { "0800": [25, 3, 2], "0805": [50, 0, 0], "0810": [25, 0, 0] });
  assert.deepEqual(d.totals, { steps: 100, activeMin: 3, flights: 2 });
  assert.equal(d.mode, undefined);
  assert.equal(d.date, "2026-10-01");
});

test("sample mode: rounding (steps/flights 1 dp, minutes 2 dp), empty slots dropped, totals from raw values", async () => {
  const out = await call(
    sample("2026-10-01", [smp("2026-10-01T09:00", "2026-10-01T09:15", 1.4)], {
      active: [smp("2026-10-01T09:00", "2026-10-01T09:15", 1)],
      flights: [
        smp("2026-10-01T10:00", "2026-10-01T10:05", 0.04),
        smp("2026-10-01T10:05", "2026-10-01T10:10", 0.5),
      ],
    }),
  );
  const d = await doc("2026-10-01");
  assert.deepEqual(d.slots, {
    "0900": [0.5, 0.33, 0],
    "0905": [0.5, 0.33, 0],
    "0910": [0.5, 0.33, 0],
    1005: [0, 0, 0.5],
  });
  assert.deepEqual(out.body.slots, 4);
  assert.deepEqual(d.totals, { steps: 1, activeMin: 1, flights: 1 }); // from the unrounded values
});

test("sample mode: midnight crossings, other days, missing end, bad values and sources", async () => {
  await call(
    sample("2026-10-01", [
      smp("2026-09-30T23:50", "2026-10-01T00:10", 200), // 10 min before, 10 min after midnight
      smp("2026-10-01T23:55", "2026-10-02T00:05", 100), // runs into the next day
      smp("2026-09-30T23:55", "2026-09-30T23:59", 999), // previous day only
      smp("2026-10-02T00:00", "2026-10-02T00:05", 999), // next day only
      smp("2026-09-30T23:00", "2026-10-02T01:00", 999), // spans the whole day: ignored
      smp("2026-10-01T24:00", "2026-10-01T24:00", 999), // 24:00 is not a slot
      smp("2026-10-01T12:00", undefined, 7), // no end → instantaneous
      smp("2026-10-01T12:00", "2026-10-01T12:00", 0), // zero
      smp("2026-10-01T12:00", "2026-10-01T12:00", "x"), // NaN
      smp("2026-10-01T12:00", "2026-10-01T12:05", "Infinity"),
      smp("2026-10-01T12:00", "2026-10-01T12:00", -3), // negative
      smp("garbage", "2026-10-01T12:00", 5), // unparseable
      smp("2026-10-01T13:00", "2026-10-01T13:05", 50, "iPhone"), // not the Watch
    ]),
  );
  const d = await doc("2026-10-01");
  assert.deepEqual(d.slots, {
    "0000": [50, 0, 0],
    "0005": [50, 0, 0],
    1200: [7, 0, 0],
    2355: [50, 0, 0],
  });
  assert.deepEqual(d.totals, { steps: 157, activeMin: 0, flights: 0 });
});

test("sample mode: without a Watch source every source counts; src is optional", async () => {
  await call(
    sample("2026-10-01", [
      smp("2026-10-01T08:00", "2026-10-01T08:05", 10, "iPhone"),
      { s: "2026-10-01T08:00", e: "2026-10-01T08:05", v: 5 },
    ]),
  );
  assert.deepEqual((await doc("2026-10-01")).slots, { "0800": [15, 0, 0] });
  await call(
    sample("2026-10-02", [], { active: [smp("2026-10-02T06:01", "2026-10-02T06:04", 3)] }),
  );
  assert.deepEqual((await doc("2026-10-02")).slots, { "0600": [0, 3, 0] });
  await call(sample("2026-10-03", [], { active: [], flights: [] }));
  const empty = await doc("2026-10-03");
  assert.deepEqual([empty.slots, empty.totals], [{}, { steps: 0, activeMin: 0, flights: 0 }]);
});

test("sample mode is chosen when any of steps/active/flights is an array", async () => {
  const out = await call(
    req({
      date: "2026-10-01",
      steps: 5000,
      active: 10,
      flights: [smp("2026-10-01T07:00", "2026-10-01T07:05", 2)],
    }),
  );
  assert.deepEqual(out.body.totals, { steps: 0, activeMin: 0, flights: 2 });
  assert.equal((await doc("2026-10-01")).mode, undefined);
});
