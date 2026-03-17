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
