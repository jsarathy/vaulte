// src/lib/dayBudget.js — the Daily log's energy budget for one day: activity tier, energy
// target (TDEE), macro targets, net kcal, what's left, and the figures the summary row shows.
import { ACTIVITY_LEVELS, calcMacros, fmt } from "../constants/helpers.js";

/** Resting energy (Mifflin–St Jeor) for the reference calculator's sex, weight, height, age. */
export const bmr = ({ sex, weight, height, age }) =>
  sex === "m"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

/** The activity tier for the kcal burned: none, up to 150, up to 300, more. */
export function activityTier(burned) {
  if (burned > 300) return ACTIVITY_LEVELS[3];
  if (burned > 150) return ACTIVITY_LEVELS[2];
  return ACTIVITY_LEVELS[burned > 0 ? 1 : 0];
}

/**
 * The day's budget: totals from getDayTotals, the Apple Watch kcal on top of logged workouts,
 * and the calculator ({ sex, age, height, weight, protein (g/kg), fatPct }).
 */
export function dayBudget(totals, appleKcal, calc) {
  const burned = totals.exerciseBurned + appleKcal;
  const tier = activityTier(burned);
  const tdee = Math.round(bmr(calc) * tier.factor);
  const target = calcMacros(tdee, {
    weight: calc.weight,
    proteinPerKg: calc.protein,
    fatPct: calc.fatPct / 100,
  });
  const net = totals.foodKcal - burned;
  const pct = Math.min(100, Math.round((net / tdee) * 100)); // may be negative
  return { burned, tier, tdee, target, net, left: tdee - net, pct };
}

/** Protein, fat and carb pills: grams eaten, over the target or not, and their colour. */
export const macroPills = (totals, target) =>
  [
    ["Protein", totals.protein, target.protein_g, "blue"],
    ["Fat", totals.fat, target.fat_g, "amber"],
    ["Carbs", totals.carbs, target.carbs_g, "amber"],
  ].map(([label, eaten, goal, tone]) => ({
    label,
    grams: fmt(eaten),
    over: eaten > goal,
    tone,
  }));

/** ["-", "1,743"] while under the target (0 included), ["+", "14"] past it. */
export const leftParts = (left) => [
  left >= 0 ? "-" : "+",
  Math.abs(Math.round(left)).toLocaleString(),
];

const card = (label, value, note) => ({ label, value, note, warn: false });

/** "+23g over" / "241g left" against the carbs target. */
function carbsCard(eaten, goal) {
  const over = eaten > goal;
  const note = over ? `+${fmt(eaten - goal)}g over` : `${fmt(goal - eaten)}g left`;
  return { ...card("Net carbs", `${fmt(eaten)}g`, note), warn: over };
}

/** The summary row's four cards: label, figure, note, and whether the note is a warning. */
export function summaryCards(totals, budget, appleKcal) {
  const { burned, target } = budget;
  const apple = appleKcal ? ` (incl. ${Math.round(appleKcal)} Apple)` : "";
  const exercise = totals.exerciseBurned;
  return [
    card(
      "Consumed",
      Math.round(totals.foodKcal).toLocaleString(),
      `${Math.round(burned)} kcal burned${apple}`,
    ),
    card("Protein", `${fmt(totals.protein)}g`, `target ${target.protein_g}g`),
    carbsCard(totals.net_carbs, target.carbs_g),
    card(
      "Fat burned",
      `${fmt(totals.fatBurnedG)}g`,
      exercise ? `${Math.round(exercise)} kcal exercise` : "no exercise logged",
    ),
  ];
}

/** The date of the day `step` places along the loaded list (1: older, -1: newer), or null. */
export function adjacentDay(allDays, date, step) {
  const i = allDays.findIndex((d) => d.date === date);
  return allDays[i + step]?.date ?? null;
}
