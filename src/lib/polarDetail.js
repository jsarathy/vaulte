// src/lib/polarDetail.js — the Daily log's Polar session box: title, start, stats, and whether
// heart rate can be drawn or fetched.
import { calcFatBurned } from "../constants/helpers.js";

/** "INDOOR_CYCLING" → "Indoor Cycling"; no sport → "Exercise". */
export const sportTitle = (sport) =>
  sport
    ? sport
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Exercise";

/** "Sunday 4 October 2026 · 07:30" (local); "" without a start time. */
export function startedAt(startTime) {
  if (!startTime) return "";
  const d = new Date(startTime);
  const date = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return time ? `${date} · ${time}` : date;
}

/** [label, value] rows; optional figures only when the session has them. */
export function sessionStats(s) {
  const fat = calcFatBurned(s.calories, s.fat_pct);
  return [
    ["Duration", `${Math.round(s.duration_min || 0)} min`],
    ["Calories", `${s.calories} kcal`],
    s.hr_avg ? ["Avg HR", `${s.hr_avg} bpm`] : null,
    s.hr_max ? ["Max HR", `${s.hr_max} bpm`] : null,
    s.fat_pct != null ? ["Fat burn %", `${s.fat_pct}%`] : null,
    fat ? ["Fat burned", `${fat.fatGrams}g · ${fat.fatKcal} kcal`] : null,
    s.device ? ["Device", s.device] : null,
  ].filter(Boolean);
}

/** Two or more real readings (gaps are null): the chart can be drawn. */
export const hasHeartRate = (s) => (s.hr_samples || []).filter((v) => v != null).length > 1;

/** Heart rate can be fetched from Polar for a session it knows about. */
export const canFetchHeartRate = (s) => Boolean(s.exercise_url || s.polar_user_id);

/** The message for a failed fetch reply. */
export const fetchError = (data) => data.message || data.error || "Failed to fetch HR data.";
