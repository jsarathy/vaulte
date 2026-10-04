// src/lib/dayMeals.js — adding entries to a day's meals (shared by the Add Entry logging paths).

/**
 * The chosen meal's id in the day. Slot choices for meals the day doesn't have yet are
 * "__slot__<name>" and resolve to that meal by name; null if there's no such meal.
 */
export function mealIdIn(day, value) {
  if (!value?.startsWith("__slot__")) return value;
  return day.meals.find((m) => m.name === value.replace("__slot__", ""))?.id || null;
}

/** The day with the entries added after what's already in that meal. */
export const withItemsInMeal = (day, mealId, items) => ({
  ...day,
  meals: day.meals.map((m) =>
    m.id === mealId ? { ...m, items: [...(m.items || []), ...items] } : m,
  ),
});
