// src/lib/polarLog.js — the "log a Polar session" box: what it shows about a session (name,
// time, stats, heart-rate line and zones) and the exercise entry it logs.

/** (sic) Every letter ends up capitalised ("INDOOR CYCLING"); kept as is — a separate fix. */
export const sportName = (sport) =>
  sport
    ? sport
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\w/g, (c) => c.toUpperCase())
    : "Exercise";

/** "Saturday 3 October" and "08:00" from start_time; the stored date (no time) otherwise. */
export function sessionWhen(s) {
  if (!s.start_time) return { dateText: s.date || "", timeText: "" };
  const d = new Date(s.start_time);
  return {
    dateText: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    timeText: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** The day the session is logged to: its start date, its stored date, else today (UTC). */
export const sessionDate = (s, now) =>
  s.start_time ? s.start_time.split("T")[0] : s.date || now.toISOString().split("T")[0];

/** Fat burned (grams and kcal) from the fat-burn %; 0 when Polar gave none. */
export function fatBurned(s) {
  if (s.fat_pct == null) return { g: 0, kcal: 0 };
  const kcal = (s.calories * s.fat_pct) / 100;
  return { g: Math.round(kcal / 9), kcal: Math.round(kcal) };
}

export const durationMin = (s) => Math.round(s.duration_min || 0);

export function sessionStats(s) {
  return [
    ["Duration", `${durationMin(s)} min`],
    ["Calories", `${s.calories} kcal`],
    s.hr_avg ? ["Avg HR", `${s.hr_avg} bpm`] : null,
    s.hr_max ? ["Max HR", `${s.hr_max} bpm`] : null,
    s.fat_pct != null ? ["Fat burn", `${s.fat_pct}%`] : null,
    s.fat_pct != null ? ["Fat burned", `${fatBurned(s).g}g`] : null,
  ].filter(Boolean);
}

/** The exercise entry logged for the session (negative kcal). */
export function polarExerciseItem(s, id) {
  const fat = fatBurned(s);
  return {
    id,
    name: `${sportName(s.sport)} (${durationMin(s)} min) · Polar`,
    kcal: -s.calories,
    ...{ fat: 0, sat_fat: 0, carbs: 0, sugar: 0, fibre: 0, net_carbs: 0, protein: 0 },
    is_exercise: 1,
    fat_burned_g: fat.g,
    fat_burned_kcal: fat.kcal,
    polar_session_id: s.id,
  };
}
