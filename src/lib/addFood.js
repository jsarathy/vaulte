// src/lib/addFood.js — the "Add Food Item" form: saved-recipe matching, macros, the logged entry.
import { MACROS } from "../constants/recipeLinks.js";
import { DEFAULT_MEAL_SLOTS } from "../constants/helpers.js";
import { mealIdIn } from "./dayMeals.js";

export const EMPTY_FOOD = { name: "", ...Object.fromEntries(MACROS.map((k) => [k, ""])) };

export const MACRO_FIELDS = [
  ["kcal", "kcal"],
  ["fat", "Fat (g)"],
  ["sat_fat", "Sat Fat (g)"],
  ["carbs", "Carbs (g)"],
  ["sugar", "Sugar (g)"],
  ["fibre", "Fibre (g)"],
  ["net_carbs", "Net Carbs (g)"],
  ["protein", "Protein (g)"],
];

/** Lowercase, trimmed, internal whitespace collapsed. */
export const normName = (v) =>
  String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const hasUsableMacros = (recipe) =>
  ["kcal", "protein", "fat", "carbs"].some((k) => Number(recipe.nutrition?.[k]) > 0);

/**
 * The saved recipe with exactly this name (normalised) that carries real macros, else null.
 * Substring matching is deliberately not used: "chicken curry" must not silently resolve to
 * "Thai Chicken Curry" and attach the wrong macros — partial names are served by the list,
 * where the user picks explicitly. A macro-less recipe falls through so it can be looked up.
 */
export function findSavedRecipe(recipes, name) {
  const q = normName(name);
  if (!q) return null;
  const hit = recipes.find((r) => normName(r.name) === q);
  return hit && hasUsableMacros(hit) ? hit : null;
}

/** Saved recipes whose name contains the typed text (normalised). */
export const recipesMatching = (recipes, text) =>
  recipes.filter((r) => normName(r.name).includes(normName(text)));

export const hasNutrition = (item) => item.kcal || item.fat || item.carbs || item.protein;

export const recipeHint = ({ nutrition: n }) =>
  `${n?.kcal ?? ""} kcal · P:${n?.protein ?? ""}g F:${n?.fat ?? ""}g C:${n?.carbs ?? ""}g · tap to set portions`;

/** The form with one macro changed; net carbs follow carbs − fibre (≥ 0, 1 dp). */
export function withMacro(item, key, value) {
  const updated = { ...item, [key]: value };
  if (key !== "carbs" && key !== "fibre") return updated;
  const carbs = parseFloat(updated.carbs) || 0;
  const fibre = parseFloat(updated.fibre) || 0;
  return { ...updated, net_carbs: Math.max(0, carbs - fibre).toFixed(1) };
}

/** The logged entry: macros as numbers, blanks 0. */
export const foodEntry = (item, id) => ({
  id,
  name: item.name,
  ...Object.fromEntries(MACROS.map((k) => [k, parseFloat(item[k]) || 0])),
});

/** Meal choices for the day: its own meals once it exists, else the default slots. */
export function foodMealOptions(allDays, date) {
  const existing = allDays.find((d) => d.date === date);
  return (existing ? existing.meals : DEFAULT_MEAL_SLOTS).map((m, i) => ({
    key: m.id || i,
    value: m.id || "__slot__" + m.name,
    label: m.name,
  }));
}

/**
 * The chosen meal in the day. A slot the day doesn't have becomes a new meal when a meal
 * name is given; otherwise mealId is null.
 */
export function mealForFood(day, choice, newId) {
  const mealId = mealIdIn(day, choice.mealId);
  if (mealId || !choice.mealName) return { day, mealId };
  const meal = { id: newId(), name: choice.mealName, is_exercise: 0, items: [] };
  return { day: { ...day, meals: [...day.meals, meal] }, mealId: meal.id };
}
