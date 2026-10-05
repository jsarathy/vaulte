// tests/api/renpho-girth.test.mjs — POST /api/renpho-sync with { kind: "girth" }: Smart Tape
// Measure readings for the Body tab. Renpho's cloud stubbed (renpho-stub.mjs). No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN,
  DEVICES,
  GIRTH,
  calls,
  stubCloud,
  ok,
  login,
  pages,
  call,
  sec,
} from "./renpho-stub.mjs";

const girth = (iso, fields, extra = {}) => ({ timeStamp: sec(iso), ...fields, ...extra });

const all = {
  neckValue: 40.04,
  shoulderValue: "120.06",
  chestValue: 105,
  waistValue: 99.95,
  abdomenValue: 101,
  hipValue: 103,
  leftArmValue: 33,
  rightArmValue: 33.5,
  leftThighValue: 58,
  rightThighValue: 58.5,
  leftCalfValue: 38,
  rightCalfValue: 38.5,
  armValue: 99, // overall / custom fields aren't used
  customValue1: 5,
};
test("girth: tape readings by day in the device's time zone", async () => {
  stubCloud({
    [LOGIN]: login(),
    [GIRTH]: pages(
      Array.from({ length: 100 }, (_, i) =>
        girth("2026-09-01T08:00:00Z", { waistValue: 100 + i / 10 }, { timeZone: "+1:00" }),
      ),
      [
        girth("2026-09-01T23:30:00Z", all, { timeZone: "+1:00" }), // 00:30 on 2 Sep locally
        girth("2026-09-10T03:00:00Z", { hipValue: 102 }, { timeZone: "-5" }), // 9 Sep 22:00 locally
        girth("2026-09-03T20:00:00Z", { neckValue: 39 }, { timeZone: "+5.5" }), // 4 Sep 01:30
        girth("2026-09-05T23:00:00Z", { neckValue: 39.5 }, { timeZone: "+0:45" }), // 5 Sep 23:45
        girth("2026-09-06T22:45:00Z", { neckValue: 39.6 }, { timeZone: "+1:30" }), // 7 Sep 00:15
        { timeStamp: sec("2026-09-08T10:00:00Z") * 1000, chestValue: 104, timeZone: "UTC" }, // ms; odd zone ignored
        girth("2026-09-11T10:00:00Z", {
          chestValue: 0,
          waistValue: -1,
          hipValue: "x",
          neckValue: "Infinity",
        }), // nothing measured
        { timeStamp: 0, neckValue: 40 },
        { timeStamp: "later", neckValue: 40 },
        { neckValue: 40 },
      ],
    ),
  });
  const out = await call({ kind: "girth", fromDate: "2026-09-05" }); // the cutoff isn't applied
  assert.equal(out.statusCode, 200);
  assert.deepEqual(Object.keys(out.body), ["records", "count", "rawCount"]);
  assert.deepEqual(out.body.records, [
    { date: "2026-09-01", values: { waist: 109.9 } }, // the latest of the 100
    {
      date: "2026-09-02",
      values: {
        neck: 40,
        shoulder: 120.1,
        chest: 105,
        waist: 100,
        abdomen: 101,
        hip: 103,
        bicepL: 33,
        bicepR: 33.5,
        thighL: 58,
        thighR: 58.5,
        calfL: 38,
        calfR: 38.5,
      },
    },
    { date: "2026-09-04", values: { neck: 39 } },
    { date: "2026-09-05", values: { neck: 39.5 } },
    { date: "2026-09-07", values: { neck: 39.6 } },
    { date: "2026-09-08", values: { chest: 104 } },
    { date: "2026-09-09", values: { hip: 102 } },
  ]);
  assert.equal(out.body.count, 7);
  assert.equal(out.body.rawCount, 110);
  const reqs = calls.filter((c) => c.endpoint === GIRTH);
  assert.deepEqual(
    reqs.map((c) => c.body),
    [
      { pageNum: 1, pageSize: 100 },
      { pageNum: 2, pageSize: 100 },
    ],
  );
  assert.equal(reqs[0].headers.token, "tok-1");
  assert.equal(
    calls.some((c) => c.endpoint === DEVICES),
    false,
  );
});

test("girth: paging limits, empty replies and errors", async () => {
  const full = Array.from({ length: 100 }, () => girth("2026-09-01T08:00:00Z", { neckValue: 40 }));
  stubCloud({ [LOGIN]: login(), [GIRTH]: () => ok(full) });
  let out = await call({ kind: "girth" });
  assert.equal(calls.filter((c) => c.endpoint === GIRTH).length, 40);
  assert.equal(out.body.rawCount, 4000);
  assert.equal(out.body.count, 1);
  stubCloud({ [LOGIN]: login(), [GIRTH]: () => ({ body: { code: 0, msg: "ok", data: null } }) });
  out = await call({ kind: "girth" });
  assert.deepEqual(out.body, { records: [], count: 0, rawCount: 0 });
  stubCloud({ [LOGIN]: login(), [GIRTH]: () => ({ body: { code: 3, msg: "no" } }) });
  out = await call({ kind: "girth" });
  assert.deepEqual(
    [out.statusCode, out.body],
    [502, { error: "Girth page 1 failed: code=3, msg=no" }],
  );
  // a same-time later record wins
  stubCloud({
    [LOGIN]: login(),
    [GIRTH]: pages([
      girth("2026-09-01T08:00:00Z", { neckValue: 40 }),
      girth("2026-09-01T08:00:00Z", { neckValue: 41 }),
    ]),
  });
  out = await call({ kind: "girth" });
  assert.deepEqual(out.body.records, [{ date: "2026-09-01", values: { neck: 41 } }]);
});
