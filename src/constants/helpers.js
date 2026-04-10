// src/constants/helpers.js
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
export const fmt = n => n === 0 ? "0" : parseFloat(parseFloat(n).toFixed(1));
export const formatDate = d => {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
};
export const formatDateShort = d => {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
};

export const DEFAULT_MEAL_SLOTS = [
  { name:"☕ Breakfast",        is_exercise:0 },
  { name:"🏋️ Morning Exercise", is_exercise:1 },
  { name:"🥤 Post-Workout",     is_exercise:0 },
  { name:"🥗 Lunch",            is_exercise:0 },
  { name:"🍎 Snack",            is_exercise:0 },
  { name:"🚴 Afternoon Exercise", is_exercise:1 },
  { name:"🌙 Dinner",           is_exercise:0 },
  { name:"🌆 Evening Exercise",  is_exercise:1 },
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
  const carbs_g = Math.round((tdee - protein_g * 4 - fat_g * 9) / 4);
  return { protein_g, fat_g, carbs_g, fibre_g:30, net_carbs:Math.max(0, carbs_g - 30) };
}

export function getDayTotals(dayData) {
  if (!dayData) return { kcal:0, fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0, foodKcal:0, exerciseBurned:0 };
  let kcal=0, fat=0, carbs=0, sugar=0, fibre=0, net_carbs=0, protein=0, foodKcal=0, exerciseBurned=0;
  dayData.meals?.forEach(meal => {
    meal.items?.forEach(i => {
      kcal+=i.kcal||0; fat+=i.fat||0; carbs+=i.carbs||0; sugar+=i.sugar||0;
      fibre+=i.fibre||0; net_carbs+=i.net_carbs||0; protein+=i.protein||0;
      if (meal.is_exercise) exerciseBurned += Math.abs(i.kcal||0);
      else foodKcal += i.kcal||0;
    });
  });
  return { kcal, fat, carbs, sugar, fibre, net_carbs, protein, foodKcal, exerciseBurned };
}

// Merge any missing DEFAULT_MEAL_SLOTS into an existing day without changing existing meal IDs.
// Safe to call on any day loaded from Firestore — only adds, never removes.
// Custom meals (names not in DEFAULT_MEAL_SLOTS) keep their original position.
export function ensureMealSlots(day) {
  if (!day) return day;
  const existing = day.meals || [];
  const existingNames = new Set(existing.map(m => m.name));
  const missing = DEFAULT_MEAL_SLOTS
    .filter(s => !existingNames.has(s.name))
    .map(s => ({ id:genId(), name:s.name, is_exercise:s.is_exercise, items:[] }));
  if (missing.length === 0) return { ...day, meals: existing.map(m => ({ ...m, items: m.items || [] })) };
  // Insert each missing default slot immediately after the last existing meal
  // whose default-order index is lower. Custom meals are never moved.
  const allNames = DEFAULT_MEAL_SLOTS.map(s => s.name);
  let result = existing.map(m => ({ ...m, items: m.items || [] }));
  for (const slot of missing) {
    const slotIdx = allNames.indexOf(slot.name);
    let insertAfter = -1;
    for (let i = 0; i < result.length; i++) {
      const ri = allNames.indexOf(result[i].name);
      if (ri !== -1 && ri < slotIdx) insertAfter = i;
    }
    result.splice(insertAfter + 1, 0, slot);
  }
  return { ...day, meals: result };
}

// Parse ISO 8601 duration → minutes e.g. "PT1H30M45S" → 90.75
// Shared between polar-sync (server) and any client code that needs it.
export function parseDurationMin(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  return (parseFloat(m[1] || 0) * 60) + parseFloat(m[2] || 0) + (parseFloat(m[3] || 0) / 60);
}

// Compute fat burned from a Polar session's calories and fat_pct.
// Returns { fatKcal, fatGrams } or null if fat_pct is not available.
export function calcFatBurned(calories, fat_pct) {
  if (fat_pct == null || calories == null) return null;
  const fatKcal  = Math.round(calories * fat_pct / 100);
  const fatGrams = Math.round(fatKcal / 9);
  return { fatKcal, fatGrams };
}
