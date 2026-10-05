// src/lib/referenceDiet.js — the Compare tab's numbers: Mifflin-St Jeor BMR, the activity rows
// (TDEE and macros per level) and the day-comparison slots (which day shows, swapping one out).
import { ACTIVITY_LEVELS, calcMacros } from "../constants/helpers.js"; // extension: node tests import this

export const bmr = ({ sex, age, height, weight }) =>
  10 * weight + 6.25 * height - 5 * age + (sex === "m" ? 5 : -161);

// One row per activity level: its TDEE (rounded) and the macro targets for it
export const activityRows = (BMR, { weight, proteinPerKg, fatPct }) =>
  ACTIVITY_LEVELS.map((lvl) => {
    const td = Math.round(BMR * lvl.factor);
    return { ...lvl, td, macros: calcMacros(td, { weight, proteinPerKg, fatPct: fatPct / 100 }) };
  });

export const MACRO_ROWS = [
  ["Fat", "fat"],
  ["Carbs", "carbs"],
  ["Net C", "net_carbs"],
  ["Fibre", "fibre"],
  ["Protein", "protein"],
  ["Sugar", "sugar"],
];

export const findDay = (allDays, date) => (date && allDays.find((d) => d.date === date)) || null;

// The day a slot shows: the live day for its date, else what was stored for the slot
export const slotDay = (date, allDays, stored) => findDay(allDays, date) || stored;

// Slot `idx` set to `date`: new slots and data arrays (the stored day is the one found, or none)
export function swapSlot({ slots, data }, idx, { date, allDays }) {
  const nextSlots = [...slots];
  nextSlots[idx] = date;
  const nextData = [...data];
  nextData[idx] = findDay(allDays, date);
  return { slots: nextSlots, data: nextData };
}
