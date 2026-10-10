// api/_polar/hrFetch.js — one stored session's heart-rate samples fetched on demand
// (polar-fetch-hr): the URLs worth trying, the first that answers with JSON, the HR channel.
import { parseHrSamples } from "./samples.js";
import { parseDurationMin } from "../../src/constants/helpers.js";

const POLAR = "https://www.polaraccesslink.com";
const DEFAULT_RATE_S = 5;

export const authHeaders = (access_token) => ({
  Authorization: `Bearer ${access_token}`,
  Accept: "application/json",
});

/** { ok, status, data } for a JSON reply; { ok: false, status, body } otherwise (logged). */
export async function safeFetchJSON(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  console.log(`polar-fetch-hr: GET ${url} → ${r.status}, body length ${text.length}`);
  if (!r.ok) return { ok: false, status: r.status, body: text };
  if (!text.trim()) return { ok: false, status: r.status, body: "(empty body)" };
  try {
    return { ok: true, status: r.status, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, status: r.status, body: text.slice(0, 200) };
  }
}

/** The samples URLs to try: the permanent training-data API first, then the exercise's own. */
export function candidateUrls(session, sessionId, connPolarUserId) {
  const polarUserId = session.polar_user_id || connPolarUserId;
  return [
    polarUserId ? `${POLAR}/v3/users/${polarUserId}/exercises/${sessionId}/samples` : null,
    session.exercise_url ? `${session.exercise_url}/samples` : null,
  ].filter(Boolean);
}

/** One attempt as reported back: url, status, ok, and the start of Polar's reply when it failed. */
export const attemptOf = (url, result) => ({
  url,
  status: result.status,
  ok: result.ok,
  ...(result.ok ? {} : { detail: String(result.body ?? "").slice(0, 150) }),
});

/** The first URL's JSON, with every attempt noted: { data, attempts }; data null if none. */
export async function firstSamples(urls, headers) {
  const attempts = [];
  for (const url of urls) {
    const result = await safeFetchJSON(url, headers);
    attempts.push(attemptOf(url, result));
    if (result.ok) return { data: result.data, attempts };
  }
  return { data: null, attempts };
}

const noHr = (message) => ({ status: 404, body: { error: "no_hr", message } });
const typesOf = (sampleSets) => sampleSets.map((s) => s["sample-type"]).join(", ");

/** { hr_samples, recording_rate_s } from a samples reply, or the 404 { status, body } to send. */
export function hrChannel(samplesData) {
  const sampleSets = samplesData["samples"] || []; // sample-type "0" = heart rate
  const hrSet = sampleSets.find((s) => String(s["sample-type"]) === "0");
  if (!hrSet?.data) {
    return noHr(`No heart rate channel in samples. Available types: [${typesOf(sampleSets)}]`);
  }
  const hr_samples = parseHrSamples(hrSet.data);
  if (!hr_samples) return noHr("All HR values were zero — watch may not have had a lock.");
  return { hr_samples, recording_rate_s: hrSet["recording-rate"] || DEFAULT_RATE_S };
}

// --- the current v3 exercises list (no transaction): the last 30 days uploaded to Flow, with samples
export const V3_LIST = `${POLAR}/v3/exercises?samples=true`;
const WITHIN_MS = 2 * 60 * 1000;
export const WINDOW_DAYS = 30;

const asTime = (naive) => Date.parse(String(naive).slice(0, 19) + "Z"); // "2026-09-03T08:00:00", no zone
const startOf = (ex) => ex.start_time || ex["start-time"];

const DAY_MS = 86400000;
const startNear = (ex, session, ms) =>
  Math.abs(asTime(startOf(ex)) - asTime(session.start_time)) <= ms;
const sameEffort = (ex, session) =>
  ex.calories === session.calories &&
  Math.abs(parseDurationMin(ex.duration) - (session.duration_min || 0)) <= 1;

/** The listed exercise for the stored session: it started at the same time (within 2 minutes), or
 *  (Polar's clock may differ from the one first stored) the same calories and duration within a day. */
export function matchExercise(list, session) {
  if (!session.start_time) return null;
  const exact = list.find((ex) => startNear(ex, session, WITHIN_MS));
  return (
    exact || list.find((ex) => sameEffort(ex, session) && startNear(ex, session, DAY_MS)) || null
  );
}

/** What the list held, one short line each (for the error when nothing matches). */
export const summariseList = (list) =>
  list
    .slice(0, 8)
    .map(
      (ex) =>
        `${startOf(ex)} ${ex.calories ?? "?"} kcal ${Math.round(parseDurationMin(ex.duration))} min`,
    );

/** { attempt, list }: the v3 list (array, or { exercises }); list null when it cannot be read. */
export async function listRecentExercises(headers) {
  const result = await safeFetchJSON(V3_LIST, headers);
  const attempt = attemptOf(V3_LIST, result);
  if (!result.ok) return { attempt, list: null };
  const list = Array.isArray(result.data) ? result.data : result.data?.exercises;
  const exercises = Array.isArray(list) ? list : null;
  return {
    attempt: exercises ? { ...attempt, listed: exercises.length } : attempt,
    list: exercises,
  };
}

/** True when the session is older than Polar's 30-day window (counted from when it was fetched). */
export function outsideWindow(session, now = Date.now()) {
  const since = session.fetched_at || session.start_time;
  return since ? now - asTime(since) > WINDOW_DAYS * 86400000 : false;
}

/** Basic auth with the app's client id and secret (the /v3/exercises list is client-level, with a
 *  polar_user on each exercise); null when they are not set. */
export function clientHeaders(env = process.env) {
  const { POLAR_CLIENT_ID: id, POLAR_CLIENT_SECRET: secret } = env;
  if (!id || !secret) return null;
  return {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    Accept: "application/json",
  };
}

/** The exercises of one Polar user (each carries a polar_user URL); all when the user is unknown. */
export const ofUser = (list, polarUserId) =>
  polarUserId
    ? list.filter((ex) => !ex.polar_user || String(ex.polar_user).endsWith(`/${polarUserId}`))
    : list;

const withSeen = ({ attempt, auth, mine, match }) => ({
  ...attempt,
  auth,
  matched: !!match,
  ...(match || !mine ? {} : { seen: summariseList(mine) }),
});

/** One credential's list searched for the session: { match, attempt }. */
async function searchList(listing, auth, { session, polarUserId }) {
  const { attempt, list } = await listing;
  const mine = list && ofUser(list, polarUserId);
  const match = mine && matchExercise(mine, session);
  return { match, attempt: withSeen({ attempt, auth, mine, match }) };
}

/** Looks sessions up in the recent list, with the user's token then the client credentials. Each
 *  list is fetched once however many sessions are looked up. find(session) → { match, attempts }. */
export function recentFinder(userHeaders, polarUserId) {
  const tries = [
    ["user token", userHeaders],
    ["client credentials", clientHeaders()],
  ].filter(([, headers]) => headers);
  const listings = tries.map(([auth, headers]) => [auth, listRecentExercises(headers)]);
  return {
    async find(session) {
      const attempts = [];
      for (const [auth, listing] of listings) {
        const found = await searchList(listing, auth, { session, polarUserId });
        attempts.push(found.attempt);
        if (found.match) return { match: found.match, attempts };
      }
      return { match: null, attempts };
    },
  };
}
