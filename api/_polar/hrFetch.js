// api/_polar/hrFetch.js — one stored session's heart-rate samples fetched on demand
// (polar-fetch-hr): the URLs worth trying, the first that answers with JSON, the HR channel.
import { parseHrSamples } from "./samples.js";

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

/** The first URL's JSON, with every attempt noted: { data, attempts }; data null if none. */
export async function firstSamples(urls, headers) {
  const attempts = [];
  for (const url of urls) {
    const result = await safeFetchJSON(url, headers);
    attempts.push({ url, status: result.status, ok: result.ok });
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

/** The listed exercise that started when the stored session did (within 2 minutes), or null. */
export function matchExercise(list, startTime) {
  if (!startTime) return null;
  const t = asTime(startTime);
  return list.find((ex) => Math.abs(asTime(startOf(ex)) - t) <= WITHIN_MS) || null;
}

/** { attempt, list }: the v3 list (array, or { exercises }); list null when it cannot be read. */
export async function listRecentExercises(headers) {
  const result = await safeFetchJSON(V3_LIST, headers);
  const attempt = { url: V3_LIST, status: result.status, ok: result.ok };
  if (!result.ok) return { attempt, list: null };
  const list = Array.isArray(result.data) ? result.data : result.data?.exercises;
  return { attempt, list: Array.isArray(list) ? list : null };
}

/** True when the session is older than Polar's 30-day window (counted from when it was fetched). */
export function outsideWindow(session, now = Date.now()) {
  const since = session.fetched_at || session.start_time;
  return since ? now - asTime(since) > WINDOW_DAYS * 86400000 : false;
}
