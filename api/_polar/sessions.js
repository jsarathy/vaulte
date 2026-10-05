// api/_polar/sessions.js — Polar exercises fetched into the users/{uid}/polar_sessions/{id} shape.
import { parseDurationMin } from "../../src/constants/helpers.js";
import { fetchHrSamples } from "./samples.js";

/** Calories, heart-rate summary and other stats an exercise may carry. */
function exerciseStats(ex) {
  const heart = ex["heart-rate"] || {};
  return {
    calories: ex.calories || 0,
    hr_avg: heart.average || null,
    hr_max: heart.maximum || null,
    fat_pct: ex["fat-percentage"] || null,
    has_route: ex["has-route"] || false,
    device: ex.device || null,
  };
}

/** The stored session for an exercise; `hr` is { hr_samples, recording_rate_s }. */
export function sessionRecord(ex, { url, polar_user_id }, hr) {
  return {
    id: String(ex.id),
    sport: ex["detailed-sport-info"] || ex.sport || "OTHER",
    start_time: ex["start-time"],
    duration_min: parseDurationMin(ex.duration),
    ...exerciseStats(ex),
    ...hr, // int[] bpm at recording_rate_s intervals, null if unavailable
    exercise_url: url, // stored so HR can be re-fetched on demand
    polar_user_id,
    fetched_at: new Date().toISOString(),
    logged: false,
  };
}

/** One exercise with its HR samples; null when it cannot be fetched (logged). */
async function fetchSession(url, polar) {
  try {
    const r = await fetch(url, { headers: polar.auth });
    if (!r.ok) return null;
    const ex = await r.json();
    const hr = await fetchHrSamples(url, polar.auth);
    return sessionRecord(ex, { url, polar_user_id: polar.polar_user_id }, hr);
  } catch (err) {
    console.warn("Failed to fetch exercise:", url, err);
    return null;
  }
}

/** The sessions for the exercise URLs, in order, skipping any that fail. */
export async function fetchSessions(urls, polar) {
  const sessions = [];
  for (const url of urls) {
    const s = await fetchSession(url, polar);
    if (s) sessions.push(s);
  }
  return sessions;
}
