// api/_polar/v4.js — Polar AccessLink v4 (the Dynamic API): sign-in, tokens, and a stored
// session's heart rate looked up by day. Everything that touches the network gets its `fetcher`
// (and the clock and environment) from the caller, so it is unit-tested without a network.
// v3 hands an exercise over once and deletes it after the commit; v4 lets us read past days.

const AUTH = "https://auth.polar.com/oauth";
const DATA = "https://www.polaraccesslink.com/v4/data";
export const V4_SCOPE = "training_sessions:read";
const WITHIN_MS = 2 * 60 * 1000;
const DAY_MS = 86400000;
const REFRESH_MARGIN_MS = 60 * 1000;
const DEFAULT_LIFETIME_S = 12 * 3600; // Polar's access tokens last 12 hours
const DEFAULT_RATE_S = 5;

/** Where to send the person to approve v4 access; `state` comes back with the code. */
export const v4AuthUrl = ({ clientId, redirectUri, state }) =>
  `${AUTH}/authorize?` +
  new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: V4_SCOPE,
    state,
  });

const basicAuth = ({ POLAR_CLIENT_ID: id, POLAR_CLIENT_SECRET: secret }) =>
  id && secret ? `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` : null;

/** { access_token, refresh_token, expires_at } from a token reply. */
export const tokensFrom = (json, now) => ({
  access_token: json.access_token,
  refresh_token: json.refresh_token || null,
  expires_at: new Date(now + (json.expires_in || DEFAULT_LIFETIME_S) * 1000).toISOString(),
});

const failure = (status, detail) => ({
  ok: false,
  status,
  detail: String(detail).slice(0, 150),
});

/** { ok: true, tokens } from the token endpoint, or { ok: false, status, detail }. */
async function tokenCall(form, { env, fetcher, now }) {
  const authorization = basicAuth(env);
  if (!authorization) return failure(0, "client id or secret not set");
  const r = await fetcher(`${AUTH}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: authorization,
      Accept: "application/json",
    },
    body: new URLSearchParams(form).toString(),
  });
  if (!r.ok) return failure(r.status, await r.text());
  return { ok: true, tokens: tokensFrom(await r.json(), now) };
}

/** The tokens for an authorisation code. */
export const exchangeV4Code = (code, redirectUri, deps) =>
  tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri }, deps);

const refreshV4 = (refreshToken, deps) =>
  tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken }, deps);

/** { access_token, saved? }: the stored token while it is good, else a refreshed one (`saved` is
 *  the connection to store again); { error } with the failed attempt when it cannot be refreshed. */
export async function freshAccess(conn, deps) {
  const left = Date.parse(conn.expires_at) - deps.now;
  if (left > REFRESH_MARGIN_MS) return { access_token: conn.access_token };
  if (!conn.refresh_token) return { error: failure(0, "token expired; sign in again") };
  const out = await refreshV4(conn.refresh_token, deps);
  if (!out.ok) return { error: out };
  const tokens = { ...out.tokens, refresh_token: out.tokens.refresh_token || conn.refresh_token };
  return { access_token: tokens.access_token, saved: { ...conn, ...tokens } };
}

const dayOf = (session) => String(session.start_time).slice(0, 10);
const shiftDay = (day, days) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// Polar wants a full date-time ("2026-09-25T00:00:00Z"); a bare date is a 400 "could not be parsed".
const midnight = (day) => `${day}T00:00:00Z`;

/** The list URL for one day, with heart-rate samples (with `features` Polar allows one day). */
export const dayUrl = (day) =>
  `${DATA}/training-sessions/list?` +
  new URLSearchParams({ from: midnight(day), to: midnight(shiftDay(day, 1)), features: "samples" });

/** The session's own day, then the day before and after (the clock may be in another zone). */
export function dayUrls(session) {
  const day = dayOf(session);
  return [day, shiftDay(day, -1), shiftDay(day, 1)].map(dayUrl);
}

const ZONED = /(Z|[+-]\d\d:?\d\d)$/i;
const utcMs = (iso) => Date.parse(ZONED.test(iso) ? iso : `${iso}Z`);
const naiveMs = (naive) => Date.parse(`${String(naive).slice(0, 19)}Z`);

/** The listed session that started when the stored one did (within 2 minutes), judged both as
 *  Polar's local time (start plus its zone offset) and as the time exactly as given. */
export function matchV4(list, session) {
  const want = naiveMs(session.start_time);
  const near = (ms) => Math.abs(ms - want) <= WITHIN_MS;
  return (
    list.find((ts) => {
      const start = utcMs(ts.startTime);
      return near(start + (ts.timezoneOffsetMinutes || 0) * 60000) || near(start);
    }) || null
  );
}

/** Heart-rate values with the leading zeros dropped and later zeros as null; null if none. */
function cleanValues(values) {
  const first = values.findIndex((v) => v > 0);
  return first < 0 ? null : values.slice(first).map((v) => (v > 0 ? v : null));
}

/** { hr_samples, recording_rate_s } from a listed session's HEART_RATE samples; null if none. */
export function hrFromV4(ts) {
  const all = (ts.exercises || []).flatMap((e) => e.samples?.samples || []);
  const hr = all.find((s) => s.type === "HEART_RATE" && s.values?.length);
  const hr_samples = hr && cleanValues(hr.values);
  if (!hr_samples) return null;
  return { hr_samples, recording_rate_s: (hr.intervalMillis || DEFAULT_RATE_S * 1000) / 1000 };
}

/** One list request: { ok, status, list } or { ok: false, status, detail }. */
async function getList(url, token, fetcher) {
  const r = await fetcher(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) return failure(r.status, await r.text());
  const json = await r.json().catch(() => ({}));
  return { ok: true, status: r.status, list: json.trainingSessions || [] };
}

/** One request as reported back, like the v3 attempts. */
const attemptOf = (url, got, extra = {}) => ({
  url,
  auth: "v4",
  status: got.status,
  ok: got.ok,
  ...(got.ok ? { listed: got.list.length } : { detail: got.detail }),
  ...extra,
});

/** { hr, attempts, saved? }: the session's heart rate from v4 (null if not found) and each request
 *  made; `saved` is the refreshed connection to store. `conn` is the stored v4 connection. */
export async function fetchV4Hr({ conn, session }, deps) {
  const access = await freshAccess(conn, deps);
  if (access.error) return { hr: null, attempts: [attemptOf("token refresh", access.error)] };
  const attempts = [];
  for (const url of dayUrls(session)) {
    const got = await getList(url, access.access_token, deps.fetcher);
    const ts = got.ok && matchV4(got.list, session);
    const hr = ts && hrFromV4(ts);
    attempts.push(attemptOf(url, got, { matched: !!ts, hr: !!hr }));
    if (hr) return { hr, attempts, saved: access.saved };
  }
  return { hr: null, attempts, saved: access.saved };
}
