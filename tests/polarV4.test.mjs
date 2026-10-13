// tests/polarV4.test.mjs — Polar AccessLink v4: sign-in URL, token calls, day lookups, matching and
// heart rate. The network is a stub passed in as `fetcher`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  V4_SCOPE,
  dayUrl,
  dayUrls,
  exchangeV4Code,
  fetchV4Hr,
  freshAccess,
  hrFromV4,
  matchV4,
  tokensFrom,
  v4AuthUrl,
} from "../api/_polar/v4.js";

const NOW = Date.parse("2026-10-13T10:00:00Z");
const ENV = { POLAR_CLIENT_ID: "cid", POLAR_CLIENT_SECRET: "sec" };
const BASIC = "Basic " + Buffer.from("cid:sec").toString("base64");
const session = { start_time: "2026-09-25T10:42:00" };

/** A fetcher that answers by URL prefix with { status, json } or { status, text }; records calls. */
const stub = (routes) => {
  const calls = [];
  const fetcher = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const key = Object.keys(routes).find((k) => String(url).startsWith(k));
    if (!key) throw new Error(`unexpected ${url}`);
    const r = routes[key];
    return {
      ok: r.status < 300,
      status: r.status,
      text: async () => r.text ?? "",
      json: async () => {
        if (r.badJson) throw new Error("not json");
        return r.json;
      },
    };
  };
  return { fetcher, calls };
};

const hrSession = (start, values, extra = {}) => ({
  startTime: start,
  timezoneOffsetMinutes: 180,
  exercises: [{ samples: { samples: [{ type: "HEART_RATE", intervalMillis: 1000, values }] } }],
  ...extra,
});

test("v4AuthUrl: Polar's v4 authorise page with the training-sessions scope and the state", () => {
  const url = new URL(v4AuthUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "S" }));
  assert.equal(url.origin + url.pathname, "https://auth.polar.com/oauth/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "cid");
  assert.equal(url.searchParams.get("redirect_uri"), "https://x/cb");
  assert.equal(url.searchParams.get("scope"), V4_SCOPE);
  assert.equal(url.searchParams.get("state"), "S");
  assert.equal(V4_SCOPE, "training_sessions:read");
});

test("tokensFrom: the expiry is now plus the lifetime (12 hours when not given)", () => {
  assert.deepEqual(tokensFrom({ access_token: "a", refresh_token: "r", expires_in: 60 }, NOW), {
    access_token: "a",
    refresh_token: "r",
    expires_at: "2026-10-13T10:01:00.000Z",
  });
  const t = tokensFrom({ access_token: "a" }, NOW);
  assert.equal(t.refresh_token, null);
  assert.equal(t.expires_at, "2026-10-13T22:00:00.000Z");
});

test("exchangeV4Code: posts the code with Basic auth and returns the tokens", async () => {
  const { fetcher, calls } = stub({
    "https://auth.polar.com/oauth/token": {
      status: 200,
      json: { access_token: "a", refresh_token: "r", expires_in: 3600 },
    },
  });
  const out = await exchangeV4Code("CODE", "https://x/cb", { env: ENV, fetcher, now: NOW });
  assert.equal(out.ok, true);
  assert.equal(out.tokens.access_token, "a");
  const [{ url, opts }] = calls;
  assert.equal(url, "https://auth.polar.com/oauth/token");
  assert.equal(opts.method, "POST");
  assert.equal(opts.headers.Authorization, BASIC);
  assert.equal(opts.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(opts.headers.Accept, "application/json");
  const form = new URLSearchParams(opts.body);
  assert.equal(form.get("grant_type"), "authorization_code");
  assert.equal(form.get("code"), "CODE");
  assert.equal(form.get("redirect_uri"), "https://x/cb");
});

test("exchangeV4Code: a refusal gives the status and the start of Polar's reason; no secret, no call", async () => {
  const refuse = stub({
    "https://auth.polar.com/oauth/token": { status: 400, text: "x".repeat(300) },
  });
  const out = await exchangeV4Code("C", "u", { env: ENV, fetcher: refuse.fetcher, now: NOW });
  assert.deepEqual(out, { ok: false, status: 400, detail: "x".repeat(150) });
  const none = stub({});
  const missing = await exchangeV4Code("C", "u", {
    env: { POLAR_CLIENT_ID: "cid" },
    fetcher: none.fetcher,
    now: NOW,
  });
  assert.deepEqual(missing, { ok: false, status: 0, detail: "client id or secret not set" });
  assert.equal(none.calls.length, 0);
  const noId = await exchangeV4Code("C", "u", {
    env: { POLAR_CLIENT_SECRET: "s" },
    fetcher: none.fetcher,
    now: NOW,
  });
  assert.equal(noId.status, 0);
});

test("freshAccess: a token with time left is used as it is", async () => {
  const conn = {
    access_token: "old",
    refresh_token: "r",
    expires_at: new Date(NOW + 5 * 60000).toISOString(),
  };
  const { fetcher, calls } = stub({});
  assert.deepEqual(await freshAccess(conn, { env: ENV, fetcher, now: NOW }), {
    access_token: "old",
  });
  assert.equal(calls.length, 0);
});

test("freshAccess: an expired token, or one about to expire, is refreshed and the connection to store comes back", async () => {
  const { fetcher, calls } = stub({
    "https://auth.polar.com/oauth/token": {
      status: 200,
      json: { access_token: "new", expires_in: 3600 },
    },
  });
  for (const left of [-1000, 30000]) {
    const conn = {
      access_token: "old",
      refresh_token: "r1",
      expires_at: new Date(NOW + left).toISOString(),
      kept: 1,
    };
    const out = await freshAccess(conn, { env: ENV, fetcher, now: NOW });
    assert.equal(out.access_token, "new");
    assert.equal(out.saved.access_token, "new");
    assert.equal(out.saved.refresh_token, "r1"); // Polar sent no new one: keep the old
    assert.equal(out.saved.kept, 1);
    assert.equal(out.saved.expires_at, "2026-10-13T11:00:00.000Z");
  }
  const form = new URLSearchParams(calls[0].opts.body);
  assert.equal(form.get("grant_type"), "refresh_token");
  assert.equal(form.get("refresh_token"), "r1");
});

test("freshAccess: a refresh token that Polar rotates replaces the old one", async () => {
  const { fetcher } = stub({
    "https://auth.polar.com/oauth/token": {
      status: 200,
      json: { access_token: "n", refresh_token: "r2" },
    },
  });
  const conn = {
    access_token: "o",
    refresh_token: "r1",
    expires_at: new Date(NOW - 1).toISOString(),
  };
  assert.equal(
    (await freshAccess(conn, { env: ENV, fetcher, now: NOW })).saved.refresh_token,
    "r2",
  );
});

test("freshAccess: with no refresh token, or when the refresh is refused, it says so", async () => {
  const expired = new Date(NOW - 1).toISOString();
  const none = stub({});
  const a = await freshAccess(
    { access_token: "o", expires_at: expired },
    { env: ENV, fetcher: none.fetcher, now: NOW },
  );
  assert.deepEqual(a, { error: { ok: false, status: 0, detail: "token expired; sign in again" } });
  const refused = stub({
    "https://auth.polar.com/oauth/token": { status: 400, text: "invalid_grant" },
  });
  const b = await freshAccess(
    { access_token: "o", refresh_token: "r", expires_at: expired },
    { env: ENV, fetcher: refused.fetcher, now: NOW },
  );
  assert.deepEqual(b, { error: { ok: false, status: 400, detail: "invalid_grant" } });
  const noExpiry = await freshAccess(
    { access_token: "o", refresh_token: "r" },
    { env: ENV, fetcher: refused.fetcher, now: NOW },
  );
  assert.equal(noExpiry.error.status, 400); // an unknown expiry counts as expired
});

test("dayUrl and dayUrls: one day with samples; the session's day, then the day before and after", () => {
  const url = new URL(dayUrl("2026-09-25"));
  assert.equal(
    url.origin + url.pathname,
    "https://www.polaraccesslink.com/v4/data/training-sessions/list",
  );
  assert.equal(url.searchParams.get("from"), "2026-09-25T00:00:00Z");
  assert.equal(url.searchParams.get("to"), "2026-09-26T00:00:00Z");
  assert.equal(url.searchParams.get("features"), "samples");
  const days = dayUrls(session).map((u) => new URL(u).searchParams.get("from").slice(0, 10));
  assert.deepEqual(days, ["2026-09-25", "2026-09-24", "2026-09-26"]);
  const edge = dayUrls({ start_time: "2026-12-31T23:30:00" }).map((u) =>
    new URL(u).searchParams.get("to"),
  );
  assert.deepEqual(edge, ["2027-01-01T00:00:00Z", "2026-12-31T00:00:00Z", "2027-01-02T00:00:00Z"]);
});

test("matchV4: the session that started at the same time, as Polar's local time or as given, within 2 minutes", () => {
  const local = { startTime: "2026-09-25T07:42:30Z", timezoneOffsetMinutes: 180, id: "local" };
  const asGiven = { startTime: "2026-09-25T10:41:00", id: "given" }; // no zone: taken as written
  const far = { startTime: "2026-09-25T10:50:00Z", id: "far" };
  assert.equal(matchV4([far, local], session).id, "local");
  assert.equal(matchV4([far, asGiven], session).id, "given");
  assert.equal(matchV4([far], session), null);
  assert.equal(matchV4([], session), null);
  const offset = { startTime: "2026-09-25T10:42:00+03:00", id: "zoned" }; // 07:42Z, no offset field: not the stored 10:42
  assert.equal(matchV4([offset], session), null);
  assert.equal(
    matchV4(
      [{ startTime: "2026-09-25T07:44:00Z", timezoneOffsetMinutes: 180, id: "edge" }],
      session,
    ).id,
    "edge",
  );
  assert.equal(
    matchV4([{ startTime: "2026-09-25T07:44:01Z", timezoneOffsetMinutes: 180 }], session),
    null,
  );
});

test("hrFromV4: the HEART_RATE series, leading zeros dropped and later zeros as null, at its interval", () => {
  assert.deepEqual(hrFromV4(hrSession("x", [0, 0, 90, 0, 100])), {
    hr_samples: [90, null, 100],
    recording_rate_s: 1,
  });
  const slow = {
    exercises: [
      { samples: { samples: [{ type: "HEART_RATE", intervalMillis: 5000, values: [80] }] } },
    ],
  };
  assert.equal(hrFromV4(slow).recording_rate_s, 5);
  const noRate = { exercises: [{ samples: { samples: [{ type: "HEART_RATE", values: [80] }] } }] };
  assert.equal(hrFromV4(noRate).recording_rate_s, 5);
  const second = {
    exercises: [
      { samples: { samples: [{ type: "SPEED", values: [1] }] } },
      { samples: { samples: [{ type: "HEART_RATE", intervalMillis: 2000, values: [70, 71] }] } },
    ],
  };
  assert.deepEqual(hrFromV4(second), { hr_samples: [70, 71], recording_rate_s: 2 });
});

test("hrFromV4: no samples, no heart-rate series, empty or all-zero values give null", () => {
  assert.equal(hrFromV4({}), null);
  assert.equal(hrFromV4({ exercises: [{}] }), null);
  assert.equal(hrFromV4({ exercises: [{ samples: {} }] }), null);
  assert.equal(
    hrFromV4({ exercises: [{ samples: { samples: [{ type: "SPEED", values: [1] }] } }] }),
    null,
  );
  assert.equal(hrFromV4(hrSession("x", [])), null);
  assert.equal(hrFromV4(hrSession("x", [0, 0])), null);
  assert.equal(hrFromV4({ exercises: [{ samples: { samples: [{ type: "HEART_RATE" }] } }] }), null);
});

const LIST = "https://www.polaraccesslink.com/v4/data/training-sessions/list?from=";
const goodConn = {
  access_token: "tok",
  refresh_token: "r",
  expires_at: new Date(NOW + 3600000).toISOString(),
};

test("fetchV4Hr: lists the session's day with the Bearer token and returns its heart rate", async () => {
  const hit = hrSession("2026-09-25T07:42:00Z", [0, 88, 90]);
  const { fetcher, calls } = stub({
    [LIST + "2026-09-25"]: { status: 200, json: { trainingSessions: [hit] } },
  });
  const out = await fetchV4Hr({ conn: goodConn, session }, { env: ENV, fetcher, now: NOW });
  assert.deepEqual(out.hr, { hr_samples: [88, 90], recording_rate_s: 1 });
  assert.equal(out.saved, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok");
  assert.equal(calls[0].opts.headers.Accept, "application/json");
  assert.deepEqual(out.attempts, [
    { url: calls[0].url, auth: "v4", status: 200, ok: true, listed: 1, matched: true, hr: true },
  ]);
});

test("fetchV4Hr: tries the day before and after when the first day has no match, and reports each", async () => {
  const early = { start_time: "2026-09-25T01:30:00" }; // 22:30 UTC the day before, at +3 hours
  const hit = hrSession("2026-09-24T22:30:00Z", [90]);
  const { fetcher, calls } = stub({
    [LIST + "2026-09-25"]: {
      status: 200,
      json: { trainingSessions: [{ startTime: "2026-09-25T20:00:00Z" }] },
    },
    [LIST + "2026-09-24"]: { status: 200, json: { trainingSessions: [hit] } },
  });
  const out = await fetchV4Hr({ conn: goodConn, session: early }, { env: ENV, fetcher, now: NOW });
  assert.equal(out.hr.hr_samples[0], 90);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    out.attempts.map((a) => [a.listed, a.matched, a.hr]),
    [
      [1, false, false],
      [1, true, true],
    ],
  );
});

test("fetchV4Hr: a matched session with no heart rate, a refusal and an unreadable reply are reported, three days tried", async () => {
  const noHr = { startTime: "2026-09-25T07:42:00Z", timezoneOffsetMinutes: 180 };
  const { fetcher, calls } = stub({
    [LIST + "2026-09-25"]: { status: 200, json: { trainingSessions: [noHr] } },
    [LIST + "2026-09-24"]: { status: 403, text: "no consent" },
    [LIST + "2026-09-26"]: { status: 200, badJson: true },
  });
  const out = await fetchV4Hr({ conn: goodConn, session }, { env: ENV, fetcher, now: NOW });
  assert.equal(out.hr, null);
  assert.equal(calls.length, 3);
  assert.deepEqual(out.attempts[0], {
    url: calls[0].url,
    auth: "v4",
    status: 200,
    ok: true,
    listed: 1,
    matched: true,
    hr: false,
  });
  assert.deepEqual(out.attempts[1], {
    url: calls[1].url,
    auth: "v4",
    status: 403,
    ok: false,
    detail: "no consent",
    matched: false,
    hr: false,
  });
  assert.deepEqual(out.attempts[2], {
    url: calls[2].url,
    auth: "v4",
    status: 200,
    ok: true,
    listed: 0,
    matched: false,
    hr: false,
  });
});

test("fetchV4Hr: a list reply without sessions counts as none", async () => {
  const { fetcher } = stub({ [LIST]: { status: 200, json: {} } });
  const out = await fetchV4Hr({ conn: goodConn, session }, { env: ENV, fetcher, now: NOW });
  assert.equal(out.hr, null);
  assert.equal(out.attempts[0].listed, 0);
});

test("fetchV4Hr: an expired token is refreshed first and the connection to store comes back, even when nothing is found", async () => {
  const hit = hrSession("2026-09-25T07:42:00Z", [90]);
  const { fetcher, calls } = stub({
    "https://auth.polar.com/oauth/token": {
      status: 200,
      json: { access_token: "fresh", expires_in: 100 },
    },
    [LIST + "2026-09-25"]: { status: 200, json: { trainingSessions: [hit] } },
  });
  const expired = { ...goodConn, expires_at: new Date(NOW - 1).toISOString() };
  const out = await fetchV4Hr({ conn: expired, session }, { env: ENV, fetcher, now: NOW });
  assert.equal(out.saved.access_token, "fresh");
  assert.equal(calls[1].opts.headers.Authorization, "Bearer fresh");
  const miss = stub({
    "https://auth.polar.com/oauth/token": { status: 200, json: { access_token: "f2" } },
    [LIST]: { status: 200, json: { trainingSessions: [] } },
  });
  const none = await fetchV4Hr(
    { conn: expired, session },
    { env: ENV, fetcher: miss.fetcher, now: NOW },
  );
  assert.equal(none.hr, null);
  assert.equal(none.saved.access_token, "f2");
});

test("fetchV4Hr: when the token cannot be refreshed it stops with that one attempt", async () => {
  const { fetcher, calls } = stub({
    "https://auth.polar.com/oauth/token": { status: 400, text: "invalid_grant" },
  });
  const expired = { ...goodConn, expires_at: new Date(NOW - 1).toISOString() };
  const out = await fetchV4Hr({ conn: expired, session }, { env: ENV, fetcher, now: NOW });
  assert.equal(out.hr, null);
  assert.deepEqual(out.attempts, [
    { url: "token refresh", auth: "v4", status: 400, ok: false, detail: "invalid_grant" },
  ]);
  assert.equal(calls.length, 1);
});

test("freshAccess: exactly one minute left is already too little: the token is refreshed", async () => {
  const { fetcher, calls } = stub({
    "https://auth.polar.com/oauth/token": { status: 200, json: { access_token: "new" } },
  });
  const conn = {
    access_token: "old",
    refresh_token: "r",
    expires_at: new Date(NOW + 60000).toISOString(),
  };
  assert.equal((await freshAccess(conn, { env: ENV, fetcher, now: NOW })).access_token, "new");
  const more = { ...conn, expires_at: new Date(NOW + 60001).toISOString() };
  assert.equal((await freshAccess(more, { env: ENV, fetcher, now: NOW })).access_token, "old");
  assert.equal(calls.length, 1);
});

test("matchV4: a start time with its zone written out (+03:00 or +0300) is read with that zone", () => {
  for (const startTime of ["2026-09-25T10:42:00+03:00", "2026-09-25T10:42:00+0300"]) {
    const found = matchV4([{ startTime, timezoneOffsetMinutes: 180 }], session);
    assert.equal(found.startTime, startTime); // 07:42 UTC plus 3 hours is the stored 10:42
  }
  const west = { startTime: "2026-09-25T10:42:00-05:00", timezoneOffsetMinutes: -300 };
  assert.equal(matchV4([west], { start_time: "2026-09-25T10:42:00" }), west); // 15:42 UTC, local 10:42
  assert.equal(
    matchV4([{ startTime: "2026-09-25T10:42:00z" }], { start_time: "2026-09-25T10:42:00" }) !==
      null,
    true,
  );
});

test("matchV4: a stored start time that carries a zone or fraction is compared by its first 19 characters", () => {
  const found = matchV4([{ startTime: "2026-09-25T07:42:00Z", timezoneOffsetMinutes: 180 }], {
    start_time: "2026-09-25T10:42:00+03:00",
  });
  assert.notEqual(found, null);
});
