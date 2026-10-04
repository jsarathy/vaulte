// src/constants/helpers.js
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
export const fmt = (n) => (n === 0 ? "0" : parseFloat(parseFloat(n).toFixed(1)));

// Noon, so a time-zone offset can't move the date to the day before/after
const atNoon = (d) => new Date(d + "T12:00:00");
export const formatDate = (d) =>
  atNoon(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const formatDateShort = (d) =>
  atNoon(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export const DEFAULT_MEAL_SLOTS = [
  { name: "☕ Breakfast", is_exercise: 0 },
  { name: "🏋️ Morning Exercise", is_exercise: 1 },
  { name: "🥤 Post-Workout", is_exercise: 0 },
  { name: "🥗 Lunch", is_exercise: 0 },
  { name: "🍎 Snack", is_exercise: 0 },
  { name: "🚴 Afternoon Exercise", is_exercise: 1 },
  { name: "🌙 Dinner", is_exercise: 0 },
  { name: "🌆 Evening Exercise", is_exercise: 1 },
];
const SLOT_ORDER = DEFAULT_MEAL_SLOTS.map((s) => s.name);

const emptyMeal = (slot) => ({
  id: genId(),
  name: slot.name,
  is_exercise: slot.is_exercise,
  items: [],
});
export const makeMeals = () => DEFAULT_MEAL_SLOTS.map(emptyMeal);

export const ACTIVITY_LEVELS = [
  { label: "Sedentary", desc: "Desk job, little/no exercise", factor: 1.2 },
  { label: "Lightly Active", desc: "Light exercise 1–3×/week", factor: 1.375 },
  { label: "Moderately Active", desc: "Moderate exercise 3–5×/week", factor: 1.55 },
  { label: "Very Active", desc: "Hard exercise 6–7×/week", factor: 1.725 },
  { label: "Extremely Active", desc: "Physical job + hard training", factor: 1.9 },
];

// Daily macro targets: protein from body weight, fat as a share of TDEE, carbs the rest.
export function calcMacros(tdee, { weight, proteinPerKg, fatPct }) {
  const protein_g = Math.round(weight * proteinPerKg);
  const fat_g = Math.round((tdee * fatPct) / 9);
  const carbs_g = Math.round((tdee - protein_g * 4 - fat_g * 9) / 4);
  return { protein_g, fat_g, carbs_g, fibre_g: 30, net_carbs: Math.max(0, carbs_g - 30) };
}

const DAY_MACROS = ["kcal", "fat", "carbs", "sugar", "fibre", "net_carbs", "protein"];
const zeroTotals = () => ({
  ...Object.fromEntries(DAY_MACROS.map((k) => [k, 0])),
  foodKcal: 0,
  exerciseBurned: 0,
});

// Exercise entries are logged as negative kcal; their burn is counted as positive.
function addMeal(totals, meal) {
  for (const item of meal.items || []) {
    for (const k of DAY_MACROS) totals[k] += item[k] || 0;
    const kcal = item.kcal || 0;
    if (meal.is_exercise) totals.exerciseBurned += Math.abs(kcal);
    else totals.foodKcal += kcal;
  }
}

export function getDayTotals(dayData) {
  const totals = zeroTotals();
  for (const meal of dayData?.meals || []) addMeal(totals, meal);
  return totals;
}

// A day counts as logged (calendar) if it has at least one food/exercise entry
// or some notes — an emptied day's leftover record doesn't.
export function dayHasContent(day) {
  if (!day) return false;
  if ((day.meals || []).some((m) => (m.items || []).length > 0)) return true;
  return String(day.notes ?? "").trim() !== "";
}

const withItems = (meal) => ({ ...meal, items: meal.items || [] });

// Default slots in their standard order; custom meals after them, in their own order.
function bySlotOrder(a, b) {
  const ai = SLOT_ORDER.indexOf(a.name);
  const bi = SLOT_ORDER.indexOf(b.name);
  if (ai === -1 && bi === -1) return 0;
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

// Merge any missing DEFAULT_MEAL_SLOTS into an existing day without changing existing meal IDs.
// Safe to call on any day loaded from Firestore — only adds, never removes.
export function ensureMealSlots(day) {
  if (!day) return day;
  const existing = (day.meals || []).map(withItems);
  const names = new Set(existing.map((m) => m.name));
  const missing = DEFAULT_MEAL_SLOTS.filter((s) => !names.has(s.name)).map(emptyMeal);
  if (missing.length === 0) return { ...day, meals: existing };
  return { ...day, meals: [...existing, ...missing].sort(bySlotOrder) };
}

// Parse ISO 8601 duration → minutes e.g. "PT1H30M45S" → 90.75
// Shared between polar-sync (server) and any client code that needs it.
export function parseDurationMin(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  return parseFloat(m[1] || 0) * 60 + parseFloat(m[2] || 0) + parseFloat(m[3] || 0) / 60;
}

// Compute fat burned from a Polar session's calories and fat_pct.
// Returns { fatKcal, fatGrams } or null if fat_pct is not available.
export function calcFatBurned(calories, fat_pct) {
  if (fat_pct == null || calories == null) return null;
  const fatKcal = Math.round((calories * fat_pct) / 100);
  const fatGrams = Math.round(fatKcal / 9);
  return { fatKcal, fatGrams };
}

// ── Apple Watch activity ──────────────────────────────────────────────────────
// Firestore: users/{uid}/apple_activity/{YYYY-MM-DD}
//   { date, updated_at, slots: { "HHMM": [steps, activeMin, flights] } }  — 5-min slots, local time
//   or { mode: "daily", totals: { steps, activeMin, flights } }      — daily totals (Shortcut sync)
// Slots overlapping a Polar session are excluded (pro-rata) so exercise isn't double counted.
export const APPLE_KCAL = {
  perStepPerKg: 0.00057, // ≈0.04 kcal/step at 70 kg
  activeMetDelta: 1.5, // MET above walking pace for active minutes (walking already counted via steps)
  flightMetres: 3, // vertical rise per flight
  efficiency: 0.25, // muscular efficiency for climbing
};

const slotToMin = (k) => parseInt(k.slice(0, 2), 10) * 60 + parseInt(k.slice(2, 4), 10);

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
  if (/WALK/.test(s)) return 110;
  if (/HIK|TREK/.test(s)) return 100;
  return 0; // cycling, swimming, strength, rowing… — few or no steps
}

const zeroActivity = () => ({ steps: 0, activeMin: 0, flights: 0 });
const roundAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));

// Daily totals only: estimate what Apple counted during Polar sessions (assumes the Watch was worn)
function splitTotals(totals, polarSessions) {
  let estSteps = 0;
  let estMin = 0;
  for (const p of polarSessions) {
    const mins = p.duration_min || 0;
    estSteps += mins * sportCadence(p.sport);
    estMin += mins;
  }
  const steps = totals.steps || 0;
  const activeMin = totals.activeMin || 0;
  const excluded = { steps: Math.min(steps, estSteps), activeMin: Math.min(activeMin, estMin) };
  return {
    kept: {
      steps: steps - excluded.steps,
      activeMin: activeMin - excluded.activeMin,
      flights: totals.flights || 0,
    },
    excluded: { ...excluded, flights: 0 },
  };
}

// Share (0–1) of the 5-min slot starting at minute `start` covered by Polar sessions
function polarShare(start, windows) {
  const end = start + 5;
  const overlap = windows.reduce(
    (t, [a, b]) => t + Math.max(0, Math.min(end, b) - Math.max(start, a)),
    0,
  );
  return Math.min(1, overlap / 5);
}

const addShare = (target, amounts, share) =>
  Object.keys(target).forEach((k) => (target[k] += amounts[k] * share));

// 5-min slots: each slot split pro rata between kept and excluded (Polar) time
function splitSlots(slots, polarSessions) {
  const windows = polarSessions.map(polarWindow).filter(Boolean);
  const kept = zeroActivity();
  const excluded = zeroActivity();
  for (const [key, value] of Object.entries(slots || {})) {
    const [steps = 0, activeMin = 0, flights = 0] = value || [];
    const out = polarShare(slotToMin(key), windows);
    addShare(kept, { steps, activeMin, flights }, 1 - out);
    addShare(excluded, { steps, activeMin, flights }, out);
  }
  return { kept, excluded };
}

function activityKcal(kept, weightKg) {
  const W = weightKg || 84;
  const steps = kept.steps * APPLE_KCAL.perStepPerKg * W;
  const active = (kept.activeMin * APPLE_KCAL.activeMetDelta * W) / 60;
  const flights =
    (kept.flights * W * 9.81 * APPLE_KCAL.flightMetres) / APPLE_KCAL.efficiency / 4184;
  return {
    steps: Math.round(steps),
    active: Math.round(active),
    flights: Math.round(flights),
    total: Math.round(steps + active + flights),
  };
}

// activity: the apple_activity doc ({ slots } or daily { totals }); slots win when present.
export function calcAppleActivity(activity, polarSessions = [], weightKg = 84) {
  const { slots, totals } = activity || {};
  const useTotals = totals && !(slots && Object.keys(slots).length);
  const { kept, excluded } = useTotals
    ? splitTotals(totals, polarSessions)
    : splitSlots(slots, polarSessions);
  return { ...roundAll(kept), excluded: roundAll(excluded), kcal: activityKcal(kept, weightKg) };
}
