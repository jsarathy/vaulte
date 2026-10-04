// src/lib/exerciseLog.js — "Log Manual Exercise": calories, HR zone and fat burn from MET values.
import { DEFAULT_MEAL_SLOTS, ensureMealSlots } from "../constants/helpers.js";
import { withItemsInMeal } from "./dayMeals.js";

export const WEIGHT_KG = 84; // fixed for now (the form shows it read-only)

/** Exercises whose name or category contains the search text (any case; "" → all). */
export function filterExercises(exercises, search) {
  const q = search.toLowerCase();
  return exercises.filter(
    (ex) => ex.name.toLowerCase().includes(q) || ex.cat.toLowerCase().includes(q),
  );
}

// Average HR as % of an estimated max (avg × 1.12); 70% when no HR is given
function hrPercent(hrAvg) {
  const hrMax = hrAvg ? Math.round(hrAvg * 1.12) : null;
  return hrMax ? (hrAvg / hrMax) * 100 : 70;
}

const fatPercentAt = (pct) => (pct < 70 ? 70 : pct < 80 ? 60 : pct < 90 ? 40 : 20);

const ZONES = [
  [60, "Zone 1"],
  [70, "Zone 2"],
  [80, "Zone 3"],
  [90, "Zone 4"],
];
const zoneAt = (pct) => ZONES.find(([below]) => pct < below)?.[1] ?? "Zone 5";

/** Burn estimate for an exercise, or null until an exercise and a duration are given. */
export function exerciseEstimate(exercise, { durationText, hrText }) {
  if (!exercise || !durationText) return null;
  const mins = parseFloat(durationText) || 0;
  const kcal = Math.round((exercise.met * WEIGHT_KG * mins) / 60);
  const pct = hrPercent(parseFloat(hrText) || null);
  const fatPct = fatPercentAt(pct);
  const fatKcal = Math.round((kcal * fatPct) / 100);
  const fatGrams = Math.round(fatKcal / 9);
  return {
    kcal,
    fatPct,
    fatKcal,
    fatGrams,
    zone: zoneAt(pct),
    mins,
    weight: WEIGHT_KG,
    met: exercise.met,
  };
}

/** [label, value] tiles shown for an estimate. */
export const estimateTiles = (r) => [
  ["🔥 Kcal Burned", `${r.kcal} kcal`],
  ["❤️ HR Zone", r.zone],
  ["🧈 Fat Burn %", `${r.fatPct}%`],
  ["🧈 Fat Burned", `${r.fatGrams}g (${r.fatKcal} kcal)`],
];

/** The day's entry for the exercise (burn as negative kcal). */
export const exerciseItem = (exercise, r, id) => ({
  id,
  name: `${exercise.name} (${r.mins} min)`,
  kcal: -r.kcal,
  fat: 0,
  sat_fat: 0,
  carbs: 0,
  sugar: 0,
  fibre: 0,
  net_carbs: 0,
  protein: 0,
  is_exercise: 1,
  fat_burned_g: r.fatGrams,
  fat_burned_kcal: r.fatKcal,
});

/** Meal slots offered for the day: its own (with any missing defaults) or the defaults. */
export function mealSlotOptions(allDays, date) {
  const existing = allDays.find((d) => d.date === date);
  const meals = existing ? ensureMealSlots(existing).meals : DEFAULT_MEAL_SLOTS;
  return meals.map((m, i) => ({
    key: m.id || i,
    value: m.id || "__slot__" + m.name,
    label: m.name,
  }));
}

export { mealIdIn } from "./dayMeals.js";
export const withItemInMeal = (day, mealId, item) => withItemsInMeal(day, mealId, [item]);
