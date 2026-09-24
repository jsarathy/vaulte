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
export function ensureMealSlots(day) {
  if (!day) return day;
  const existing = day.meals || [];
  const existingNames = new Set(existing.map(m => m.name));
  const missing = DEFAULT_MEAL_SLOTS
    .filter(s => !existingNames.has(s.name))
    .map(s => ({ id:genId(), name:s.name, is_exercise:s.is_exercise, items:[] }));
  if (missing.length === 0) return { ...day, meals: existing.map(m => ({ ...m, items: m.items || [] })) };
  // Insert new slots in DEFAULT order, interleaved with existing ones
  const allNames = DEFAULT_MEAL_SLOTS.map(s => s.name);
  const merged = [...existing.map(m => ({ ...m, items: m.items || [] })), ...missing]
    .sort((a, b) => {
      const ai = allNames.indexOf(a.name), bi = allNames.indexOf(b.name);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  return { ...day, meals: merged };
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

// ── Apple Watch activity ──────────────────────────────────────────────────────
// Firestore: users/{uid}/apple_activity/{YYYY-MM-DD}
//   { date, updated_at, slots: { "HHMM": [steps, activeMin, flights] } }  — 5-min slots, local time
// Slots overlapping a Polar session are excluded (pro-rata) so exercise isn't double counted.
export const APPLE_KCAL = {
  perStepPerKg:  0.00057, // ≈0.04 kcal/step at 70 kg
  activeMetDelta: 1.5,    // MET above walking pace for active minutes (walking already counted via steps)
  flightMetres:   3,      // vertical rise per flight
  efficiency:     0.25,   // muscular efficiency for climbing
};

const slotToMin = k => parseInt(k.slice(0, 2), 10) * 60 + parseInt(k.slice(2, 4), 10);

function polarWindow(s) {
  const m = /T(\d{2}):(\d{2})/.exec(s?.start_time || ""); // Polar start-time is local, no TZ
  if (!m) return null;
  const start = +m[1] * 60 + +m[2];
  return [start, start + (s.duration_min || 0)];
}

// Typical steps/min for step-based Polar sports (used when only daily totals are available)
function sportCadence(sport = "") {
  const s = sport.toUpperCase();
  if (/RUN|JOG/.test(s)) return 160;
  if (/WALK/.test(s))    return 110;
  if (/HIK|TREK/.test(s)) return 100;
  return 0; // cycling, swimming, strength, rowing… — few or no steps
}

export function calcAppleActivity(slots, polarSessions = [], weightKg = 84, totals = null) {
  const windows = polarSessions.map(polarWindow).filter(Boolean);
  const kept = { steps:0, activeMin:0, flights:0 };
  const excluded = { steps:0, activeMin:0, flights:0 };
  const useTotals = totals && !(slots && Object.keys(slots).length);
  if (useTotals) {
    // Estimate what Apple counted during Polar sessions (assumes the Watch was worn)
    let estSteps = 0, estMin = 0;
    polarSessions.forEach(p => {
      const mins = p.duration_min || 0;
      estSteps += mins * sportCadence(p.sport);
      estMin   += mins;
    });
    excluded.steps     = Math.min(totals.steps || 0, estSteps);
    excluded.activeMin = Math.min(totals.activeMin || 0, estMin);
    kept.steps     = (totals.steps || 0) - excluded.steps;
    kept.activeMin = (totals.activeMin || 0) - excluded.activeMin;
    kept.flights   = totals.flights || 0;
  }
  Object.entries(useTotals ? {} : (slots || {})).forEach(([k, v]) => {
    const [st = 0, am = 0, fl = 0] = v || [];
    const s0 = slotToMin(k), s1 = s0 + 5;
    let overlap = 0;
    windows.forEach(([a, b]) => { overlap += Math.max(0, Math.min(s1, b) - Math.max(s0, a)); });
    const out = Math.min(1, overlap / 5), keep = 1 - out;
    kept.steps += st * keep; kept.activeMin += am * keep; kept.flights += fl * keep;
    excluded.steps += st * out; excluded.activeMin += am * out; excluded.flights += fl * out;
  });
  const W = weightKg || 84;
  const kcalSteps   = kept.steps * APPLE_KCAL.perStepPerKg * W;
  const kcalActive  = kept.activeMin * APPLE_KCAL.activeMetDelta * W / 60;
  const kcalFlights = kept.flights * W * 9.81 * APPLE_KCAL.flightMetres / APPLE_KCAL.efficiency / 4184;
  const r = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  return {
    ...r(kept),
    excluded: r(excluded),
    kcal: { steps:Math.round(kcalSteps), active:Math.round(kcalActive), flights:Math.round(kcalFlights),
            total:Math.round(kcalSteps + kcalActive + kcalFlights) },
  };
}
