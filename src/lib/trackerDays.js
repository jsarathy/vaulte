// src/lib/trackerDays.js — saved days: the day list, Compare's slots, deleting an entry, and the
// sidebar's 7-day average and streak.
import { getDayTotals } from "../constants/helpers.js";

export const hasEntries = (d) => !!d?.meals?.some((m) => m.items?.length);

/** The day list with this day saved: replaced or added, newest first. */
export const withSavedDay = (days, day) =>
  [day, ...days.filter((d) => d.date !== day.date)].sort((a, b) => b.date.localeCompare(a.date));

/** The day without one entry. */
export const withoutItem = (day, mealId, itemId) => ({
  ...day,
  meals: day.meals.map((m) =>
    m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m,
  ),
});

// A newly logged day newer than every slot goes first (the oldest drops off)
function withNewDay({ slots, data }, day) {
  if (slots.includes(day.date) || slots.some((d) => d && d > day.date)) return null;
  return { slots: [day.date, ...slots.slice(0, 4)], data: [day, ...data.slice(0, 4)] };
}

// An emptied day leaves; the next logged day not shown fills the last slot
function withoutDay({ slots, data }, day, days) {
  const idx = slots.indexOf(day.date);
  if (idx < 0) return null;
  const fill = days.find((d) => hasEntries(d) && !slots.includes(d.date)) || null; // (the day itself is in slots)
  return {
    slots: [...slots.filter((_, i) => i !== idx), fill?.date || null],
    data: [...data.filter((_, i) => i !== idx), fill],
  };
}

/**
 * Compare after a day is saved: { slots, data }, or null when nothing changes. days is the
 * list before the save.
 */
export const compareAfterSave = (compare, day, days) =>
  hasEntries(day) ? withNewDay(compare, day) : withoutDay(compare, day, days);

const isoDaysBack = (today, n) => {
  const d = new Date(today);
  d.setDate(today.getDate() - n);
  return d.toISOString().split("T")[0];
};

/** Days logged in a row, counting back from today (at most 30). */
export function streakDays(days, today) {
  let n = 0;
  while (n < 30 && days.find((d) => d.date === isoDaysBack(today, n))) n++;
  return n;
}

/** Average food kcal over the first 7 days in the list, as shown ("—" when 0). */
export function sevenDayAverage(days) {
  const last7 = days.slice(0, 7);
  const avg = Math.round(last7.reduce((s, d) => s + getDayTotals(d).foodKcal, 0) / last7.length);
  return avg ? avg.toLocaleString() + " kcal" : "—";
}
