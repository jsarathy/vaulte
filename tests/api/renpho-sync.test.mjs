// tests/api/renpho-sync.test.mjs — POST /api/renpho-sync, weight mode (no Firestore). Renpho's
// cloud is stubbed with its real AES-128-ECB envelope (renpho-stub.mjs). No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN,
  DEVICES,
  BASIC,
  BODY,
  calls,
  cloud,
  clock,
  errors,
  stubCloud,
  ok,
  enc,
  login,
  devices,
  pages,
  call,
  sec,
} from "./renpho-stub.mjs";

test("rejects non-POST and missing credentials", async () => {
  stubCloud({});
  let out = await call({}, "GET");
  assert.deepEqual([out.statusCode, out.body], [405, { error: "POST only" }]);
  assert.equal((await call({}, "PUT")).statusCode, 405);
  delete process.env.RENPHO_PASSWORD;
  out = await call({});
  assert.deepEqual(
    [out.statusCode, out.body],
    [500, { error: "RENPHO_EMAIL / RENPHO_PASSWORD not configured" }],
  );
  process.env.RENPHO_PASSWORD = "pw";
  delete process.env.RENPHO_EMAIL;
  assert.equal((await call({})).statusCode, 500);
  assert.equal(calls.length, 0);
});

test("logs in with the app's payload; token reused for 50 minutes", async () => {
  stubCloud({ [LOGIN]: login(), [DEVICES]: devices([]) });
  const out = await call({});
  assert.equal(out.statusCode, 200);
  const [first, second] = calls;
  assert.equal(first.endpoint, LOGIN);
  assert.equal(first.method, "POST");
  assert.deepEqual(first.headers, { "Content-Type": "application/json" });
  assert.deepEqual(first.body.questionnaire, {});
  assert.deepEqual(first.body.login, {
    password: "pw",
    areaCode: "US",
    appRevision: "6.6.0",
    cellphoneType: "VaulteSync",
    systemType: "11",
    email: "me@example.com",
    platform: "android",
  });
  const types = first.body.bindingList.deviceTypes;
  assert.equal(types.length, 20);
  assert.deepEqual(
    [types[0], types[9], types[10], types[15], types[19]],
    ["01", "0A", "0B", "10", "14"],
  );
  // later requests carry the token
  assert.equal(second.endpoint, DEVICES);
  assert.deepEqual(second.headers, {
    "Content-Type": "application/json",
    token: "tok-1",
    userId: "77",
    appVersion: "6.6.0",
    platform: "android",
  });
  assert.deepEqual(second.body, {});

  // within 50 minutes: no new login
  clock.now += 49 * 60_000;
  await call({});
  assert.deepEqual(
    calls.slice(2).map((c) => c.endpoint),
    [DEVICES],
  );
  // 50 minutes after logging in: logs in again, with the new token
  clock.now += 60_000;
  cloud[LOGIN] = login("tok-2", 78);
  await call({});
  assert.deepEqual(
    calls.slice(3).map((c) => c.endpoint),
    [LOGIN, DEVICES],
  );
  assert.equal(calls[4].headers.token, "tok-2");
  assert.equal(calls[4].headers.userId, "78");
});

test("no scale on the account: a warning", async () => {
  const warning = {
    records: [],
    count: 0,
    warning: "No scale found on the account. Open the Renpho Health app and let it sync.",
  };
  stubCloud({ [LOGIN]: login(), [DEVICES]: devices([]) });
  assert.deepEqual((await call({})).body, warning);
  cloud[DEVICES] = () => ({ body: { code: 0, msg: "ok", data: null } });
  assert.deepEqual((await call({})).body, warning);
  cloud[DEVICES] = devices("not a list");
  assert.deepEqual((await call({})).body, warning);
});

const rec = (iso, weight, extra = {}) => ({ timeStamp: sec(iso), weight, ...extra });

// Weight-mode fixture: scale tables t1 (two pages), t2 (empty: basic endpoint), t3
const fifty = Array.from({ length: 50 }, (_, i) =>
  rec(`2026-09-01T0${i % 10}:${String(i).padStart(2, "0")}:00Z`, 80 + i / 100),
);
// everything that describes the record rather than the body is left out of the metrics
const bookkeeping = Object.fromEntries(
  [
    ...["userId", "scaleType", "timeZone", "height", "age", "sex", "localCreatedAt", "mac"],
    ...["sn", "tableName", "deviceId", "measureMode", "sourceType", "deleteFlag", "syncStatus"],
    ...["tzOffset", "method", "unit", "version", "status", "createdAt", "updatedTime"],
    ...["dateOf", "ids", "stampX", "gender", "id", "serial", "uid"],
  ].map((k) => [k, 7]),
);
const t1 = [
  fifty,
  [
    rec("2026-09-02T07:00:00Z", "79.555", {
      ...bookkeeping,
      bmi: 29.1234,
      bodyfat: "31.2",
      water: 0, // not measured
      muscle: "",
      protein: "n/a",
      visfat: Infinity,
      cardiacIndex: 3.5,
    }),
    rec("2026-09-02T06:00:00Z", 81), // earlier the same day: dropped
    { timeStamp: sec("2026-09-03T07:00:00Z") * 1000, weight: 79.4 }, // milliseconds
    { timestamp: sec("2026-09-04T07:00:00Z"), weight: 79.3 },
    { created_at: sec("2026-09-05T07:00:00Z"), weight: 79.2 },
    rec("2026-08-20T07:00:00Z", 85), // before the cutoff
    rec("2026-08-21T07:00:00Z", 84.9),
    rec("2026-09-06T07:00:00Z", 0), // not weighed
    rec("2026-09-06T07:00:00Z", -1),
    rec("2026-09-06T07:00:00Z", "heavy"),
    { weight: 80 }, // no date
    { timeStamp: 0, weight: 80 },
    { timeStamp: "soon", weight: 80 },
  ],
];
const tables = { t1, t2: [], t3: [[rec("2026-09-07T07:00:00Z", 79)]] };
test("weight records: one per day (latest wins), dates, cutoff, metrics", async () => {
  stubCloud({
    [LOGIN]: login(),
    [DEVICES]: devices([
      { tableName: "t1", userIds: [99, 77] }, // the account user is listed: used
      { tableName: "" }, // skipped
      { tableName: "t2", userIds: ["99", "88"] }, // account user not listed: first id used
      { tableName: "t3", userIds: "99" }, // ids not a list: the account user
      null,
    ]),
    [BODY]: (req) => ok(tables[req.tableName][req.pageNum - 1] ?? []),
    [BASIC]: (req) => ok(req.tableName === "t2" ? [rec("2026-09-08T07:00:00Z", 78.9)] : []),
  });

  const out = await call({ fromDate: "2026-08-21" });
  assert.equal(out.statusCode, 200);
  const b = out.body;
  assert.deepEqual(
    b.records.map((r) => [r.date, r.weight]),
    [
      ["2026-08-21", 84.9],
      ["2026-09-01", 80.49], // latest of the 50 on 1 Sep (09:49)
      ["2026-09-02", 79.56],
      ["2026-09-03", 79.4],
      ["2026-09-04", 79.3],
      ["2026-09-05", 79.2],
      ["2026-09-07", 79],
      ["2026-09-08", 78.9],
    ],
  );
  // the weight itself rides along as a metric too (the Weight tab hides it)
  assert.deepEqual(b.records[2].metrics, {
    weight: 79.56,
    bmi: 29.12,
    bodyfat: 31.2,
    cardiacIndex: 3.5,
  });
  assert.deepEqual(b.records[0].metrics, { weight: 84.9 });
  assert.deepEqual(b.metricKeys, ["bmi", "bodyfat", "cardiacIndex", "weight"]);
  assert.equal(b.count, 8);
  assert.equal(b.rawCount, 50 + 13 + 1 + 1);
  assert.equal(b.rejected, 1);
  assert.equal(b.fromDate, "2026-08-21");
  assert.deepEqual(Object.keys(b), [
    "records",
    "count",
    "rawCount",
    "rejected",
    "fromDate",
    "metricKeys",
  ]);

  // the requests: pages of 50 for the scale's table and user; basic endpoint only when needed
  const reqs = calls.filter((c) => c.endpoint === BODY || c.endpoint === BASIC);
  assert.deepEqual(
    reqs.map((c) => [c.endpoint === BODY ? "body" : "basic", c.body.tableName, c.body.pageNum]),
    [
      ["body", "t1", 1],
      ["body", "t1", 2],
      ["body", "t2", 1],
      ["basic", "t2", 1],
      ["body", "t3", 1],
    ],
  );
  assert.deepEqual(reqs[0].body, { pageNum: 1, pageSize: 50, userIds: ["77"], tableName: "t1" });
  assert.deepEqual(reqs[2].body.userIds, ["99"]);
  assert.deepEqual(reqs[4].body.userIds, ["77"]);
  assert.equal(reqs[0].headers.token, "tok-1");
});

test("cutoff: only a YYYY-MM-DD date; none → nothing rejected", async () => {
  const recs = [rec("2026-08-20T07:00:00Z", 85), rec("2026-09-20T07:00:00Z", 84)];
  stubCloud({
    [LOGIN]: login(),
    [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
    [BODY]: pages(recs),
  });
  for (const fromDate of [undefined, "1 Sep 2026", 20260901, "2026-9-01", "2026-09-01T00:00"]) {
    const b = (await call(fromDate === undefined ? {} : { fromDate })).body;
    assert.equal(b.fromDate, null);
    assert.equal(b.rejected, 0);
    assert.equal(b.count, 2);
  }
  const b = (await call(undefined)).body; // no body at all
  assert.equal(b.count, 2);
  // the cutoff date itself is kept
  assert.equal((await call({ fromDate: "2026-08-20" })).body.count, 2);
  assert.equal((await call({ fromDate: "2026-08-21" })).body.rejected, 1);
});

test("same day, same time: the later record wins; days sorted", async () => {
  stubCloud({
    [LOGIN]: login(),
    [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
    [BODY]: pages([
      rec("2026-09-05T07:00:00Z", 80),
      rec("2026-09-05T07:00:00Z", 79.9),
      rec("2026-09-01T07:00:00Z", 81),
      rec("2026-09-05T06:00:00Z", 82),
      { timestamp: sec("2026-09-06T07:00:00Z"), weight: 78 }, // "timestamp" orders too
      { timestamp: sec("2026-09-06T06:00:00Z"), weight: 79 },
    ]),
  });
  const b = (await call({})).body;
  assert.deepEqual(
    b.records.map((r) => [r.date, r.weight]),
    [
      ["2026-09-01", 81],
      ["2026-09-05", 79.9],
      ["2026-09-06", 78],
    ],
  );
});

test("timestamps: seconds below 1e12, milliseconds above", async () => {
  stubCloud({
    [LOGIN]: login(),
    [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
    [BODY]: pages([
      { timeStamp: 5e10, weight: 70 }, // seconds, far in the future
      { timeStamp: 1e12 + 86_400_000, weight: 71 }, // milliseconds: 10 Sep 2001
      { timeStamp: 1e12, weight: 72 }, // 1e12 itself is milliseconds: 9 Sep 2001
      { timeStamp: 1e20, weight: 73 }, // beyond any date: skipped
    ]),
  });
  assert.deepEqual(
    (await call({})).body.records.map((r) => r.date),
    ["2001-09-09", "2001-09-10", "3554-06-09"],
  );
});

test("kind other than girth: weight mode", async () => {
  stubCloud({ [LOGIN]: login(), [DEVICES]: devices([]) });
  assert.equal((await call({ kind: "weight" })).body.count, 0);
  assert.deepEqual(
    calls.map((c) => c.endpoint),
    [LOGIN, DEVICES],
  );
});

test("page shapes, paging limits and the basic-endpoint fallback", async () => {
  const shapes = [
    { list: [rec("2026-09-01T07:00:00Z", 81)] },
    { data: [rec("2026-09-02T07:00:00Z", 80)] },
    { records: [rec("2026-09-03T07:00:00Z", 79)] },
    { measurements: [rec("2026-09-04T07:00:00Z", 78)] },
    rec("2026-09-05T07:00:00Z", 77), // a single record
  ];
  for (const [i, page] of shapes.entries()) {
    stubCloud({
      [LOGIN]: login(),
      [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
      [BODY]: pages(page),
    });
    const b = (await call({})).body;
    assert.equal(b.count, 1, `shape ${i}`);
  }
  // nothing usable: falls back to the basic endpoint
  for (const page of [{ list: [] }, { other: [1] }, "text", { list: "x" }, [], null]) {
    stubCloud({
      [LOGIN]: login(),
      [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
      [BODY]: () => ok(page),
      [BASIC]: pages([rec("2026-09-09T07:00:00Z", 76)]),
    });
    const b = (await call({})).body;
    assert.deepEqual(
      b.records.map((r) => r.date),
      ["2026-09-09"],
    );
  }
  // a reply without data ends the paging
  stubCloud({
    [LOGIN]: login(),
    [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
    [BODY]: () => ({ body: { code: 0, msg: "ok", data: null } }),
    [BASIC]: () => ({ body: { code: 0, msg: "ok" } }),
  });
  assert.equal((await call({})).body.count, 0);
  // full pages keep going, at most 40 pages
  const full = Array.from({ length: 50 }, () => rec("2026-09-01T07:00:00Z", 80));
  stubCloud({
    [LOGIN]: login(),
    [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
    [BODY]: () => ok(full),
  });
  const b = (await call({})).body;
  assert.equal(calls.filter((c) => c.endpoint === BODY).length, 40);
  assert.equal(b.rawCount, 2000);
});

test("Renpho errors become a 502 with the reason", async () => {
  const cases = [
    [{ [LOGIN]: () => ({ status: 500, body: {} }) }, `${LOGIN} HTTP 500`],
    [
      { [LOGIN]: () => ({ body: { code: 401, msg: "bad password" } }) },
      "Login failed: code=401, msg=bad password",
    ],
    [{ [LOGIN]: () => ({ body: { msg: "nope" } }) }, "Login failed: code=undefined, msg=nope"],
    [{ [LOGIN]: () => ({ body: {} }) }, "Login failed: code=undefined, msg="],
    [{ [LOGIN]: () => ok({ login: {} }) }, "Login returned no token"],
    [{ [LOGIN]: () => ok({}) }, "Login returned no token"],
    [
      { [LOGIN]: login(), [DEVICES]: () => ({ body: { code: 5, msg: "down" } }) },
      "DeviceInfo failed: code=5, msg=down",
    ],
    [
      {
        [LOGIN]: login(),
        [DEVICES]: devices([{ tableName: "t", userIds: ["77"] }]),
        [BODY]: (req) =>
          req.pageNum === 1
            ? ok(Array(50).fill(rec("2026-09-01T07:00:00Z", 80)))
            : { body: { code: 9, msg: "x" } },
      },
      `${BODY} page 2 failed: code=9, msg=x`,
    ],
  ];
  for (const [routes, error] of cases) {
    clock.now += 3_600_000;
    stubCloud(routes);
    const out = await call({});
    assert.deepEqual([out.statusCode, out.body], [502, { error }]);
    assert.ok(errors.at(-1).startsWith("renpho-sync error:"));
  }
  // an error without a message
  clock.now += 3_600_000;
  globalThis.fetch = async () => {
    throw new Error("");
  };
  const out = await call({});
  assert.deepEqual([out.statusCode, out.body], [502, { error: "Renpho sync failed" }]);
});

test("success codes and messages Renpho uses", async () => {
  for (const [code, msg] of [
    [0, "x"],
    ["0", "x"],
    [101, "x"],
    ["101", "x"],
    [200, "x"],
    ["200", "x"],
    [20000, "x"],
    ["20000", "x"],
    [999, "Success"],
    [999, "SUCCESS"],
  ]) {
    clock.now += 3_600_000;
    stubCloud({
      [LOGIN]: () => ({ body: { code, msg, data: enc({ login: { token: "t", id: 1 } }) } }),
      [DEVICES]: devices([]),
    });
    assert.equal((await call({})).statusCode, 200, `${code} ${msg}`);
  }
  for (const code of [1, 100, 201, "2000", null]) {
    clock.now += 3_600_000;
    stubCloud({
      [LOGIN]: () => ({ body: { code, msg: "x", data: enc({ login: { token: "t" } }) } }),
    });
    assert.equal((await call({})).statusCode, 502, String(code));
  }
});
