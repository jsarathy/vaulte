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
