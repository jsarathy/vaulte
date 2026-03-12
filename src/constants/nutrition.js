// src/constants/nutrition.js

import { genId } from "../utils";

export const DEFAULT_MEAL_SLOTS = [
  { name:"☕ Breakfast",        is_exercise:0 },
  { name:"🏋️ Morning Exercise", is_exercise:1 },
  { name:"🥤 Post-Workout",     is_exercise:0 },
  { name:"🥗 Lunch",            is_exercise:0 },
  { name:"🍎 Snack",            is_exercise:0 },
  { name:"🌙 Dinner",           is_exercise:0 },
];

export const makeMeals = () =>
  DEFAULT_MEAL_SLOTS.map(s => ({ id:genId(), name:s.name, is_exercise:s.is_exercise, items:[] }));

export const ACTIVITY_LEVELS = [
  { label:"Sedentary",         desc:"Desk job, little/no exercise",   factor:1.2   },
  { label:"Lightly Active",    desc:"Light exercise 1–3×/week",       factor:1.375 },
  { label:"Moderately Active", desc:"Moderate exercise 3–5×/week",    factor:1.55  },
  { label:"Very Active",       desc:"Hard exercise 6–7×/week",        factor:1.725 },
  { label:"Extremely Active",  desc:"Physical job + hard training",   factor:1.9   },
];

export function calcMacros(tdee, weight, proteinPerKg, fatPct) {
  const protein_g = Math.round(weight * proteinPerKg);
  const fat_g = Math.round(tdee * fatPct / 9);
  const carbs_g = Math.round((tdee - protein_g*4 - fat_g*9) / 4);
  return { protein_g, fat_g, carbs_g, fibre_g:30, net_carbs:Math.max(0,carbs_g-30) };
}
