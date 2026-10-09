// src/lib/trackerStart.js — shaping what NutritionTracker loads when it opens.

export const CALCULATOR_DEFAULTS = {
  sex: "m",
  age: 60,
  height: 165,
  weight: 84,
  protein: 1.4,
  fatPct: 30,
};

const NUMBERS = ["age", "height", "weight", "protein", "fatPct"];

/** The usable saved calculator inputs: a sex if set, numbers only when they are numbers. */
export function calculatorFromDoc(c) {
  const usable = Object.fromEntries(
    NUMBERS.filter((k) => Number.isFinite(c[k])).map((k) => [k, c[k]]),
  );
  return c.sex ? { sex: c.sex, ...usable } : usable;
}

/** The saved calculator document. */
export const calculatorDoc = (values, now) => ({
  sex: values.sex,
  age: values.age,
  height: values.height,
  weight: values.weight,
  protein: values.protein,
  fatPct: values.fatPct,
  updated_at: now.toISOString(),
});

const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");

/** Rows keyed by date (weight_log, body_log): the doc id is the date, fields may override. */
export const datedRows = (docs) => docs.map((d) => ({ date: d.id, ...d.data() })).sort(byDate);

/** Polar sessions not logged yet, newest first (undated last). */
export const unloggedSessions = (docs) =>
  docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => !s.logged)
    .sort((a, b) => (b.start_time || "").localeCompare(a.start_time || ""));

/** The chat window's messages for a saved conversation. */
export const chatMessagesFrom = (history, newId) =>
  history.map((h) => ({
    id: newId(),
    type: h.role === "user" ? "user" : "claude",
    text: h.content,
  }));

/** Compare's 5 slots: the first days (as loaded) that have entries, then empty slots. */
export function compareStart(days) {
  const logged = days.filter((d) => d.meals?.some((m) => m.items?.length)).slice(0, 5);
  const slots = logged.map((d) => d.date);
  return {
    slots: [...slots, ...Array(5).fill(null)].slice(0, 5),
    data: logged.concat(Array(5).fill(null)).slice(0, 5),
  };
}

/** Messages after returning from Polar's sign-in (?polar=…). */
export const POLAR_RETURN = new Map([
  ["connected", { ok: true, text: "Polar connected — click Sync to pull sessions." }],
  ["error", { ok: false, text: "Polar connection failed." }],
]);

/** How many of the newest days the first screen waits for; the rest load afterwards. */
export const RECENT_DAYS = 5;

const dateOf = (x) => (x && typeof x === "object" ? x.date : x) ?? null;
const unionByDate = (shown, stored) => [
  ...shown,
  ...stored.filter((r) => !shown.some((s) => s.date === r.date)),
];

/**
 * Days read later joined to those on screen: each date once, newest first, on-screen wins.
 * When they add no day, the ones on screen are returned as they are.
 */
export function mergeDays(shown, stored) {
  const merged = unionByDate(shown, stored);
  if (merged.length === shown.length) return shown;
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

/** weight_log / body_log rows read later joined to those on screen: oldest first, on-screen wins. */
export const mergeRows = (shown, stored) => unionByDate(shown, stored).sort(byDate);

/** Compare's slots or days (current) are replaced by next only if still the first ones (dates). */
export const keepIfTouched = (current, first, next) =>
  current.every((x, i) => dateOf(x) === dateOf(first[i])) ? next : current;
