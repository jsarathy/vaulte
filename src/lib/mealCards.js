// src/lib/mealCards.js — the Daily log's meal cards: which are open, each card's subtotals and
// whether it's a workout card, and what an entry's name links to.
import { fmt } from "../constants/helpers.js";

/** Figures per entry, in column order: kcal, fat, carbs, sugar, fibre, net carbs, protein. */
export const MACRO_KEYS = ["kcal", "fat", "carbs", "sugar", "fibre", "net_carbs", "protein"];
export const COLUMN_HEADS = ["Item", "kcal", "Fat", "Carbs", "Sugar", "Fibre", "Net C", "Prot", ""];

/** The stored open / closed state ({ [mealId]: closed }); {} when unreadable. */
export function parseCollapsed(text) {
  try {
    const parsed = JSON.parse(text || "{}");
    const isMap = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
    return isMap ? parsed : {}; // "null", a list or a plain value: start afresh
  } catch {
    return {};
  }
}

/** Cards are collapsed by default; only an explicit `false` (expanded) shows them open. */
export const isClosed = (collapsed, id) => collapsed[id] ?? true;

/** The state with one card flipped. */
export const toggled = (collapsed, id) => ({ ...collapsed, [id]: !isClosed(collapsed, id) });

/** A card's entries, subtotals per column, and whether it shows as a workout. */
export function mealSummary(meal) {
  const items = meal.items || [];
  const subtotals = MACRO_KEYS.map((k) => items.reduce((s, i) => s + (i[k] || 0), 0));
  const isExercise = meal.is_exercise || items.some((i) => i.is_exercise);
  return { items, hasItems: items.length > 0, isExercise, subtotals };
}

/** A subtotal cell: kcal plain, the rest in grams; "—" for a card with nothing logged. */
export const subtotalText = (v, i, hasItems) => (hasItems ? `${fmt(v)}${i > 0 ? "g" : ""}` : "—");

/** An entry's figures in column order; missing ones are 0. */
export const itemFigures = (item) => MACRO_KEYS.map((k) => item[k] || 0);

/** What the entry's name opens: its Polar session (workouts), its saved recipe, or nothing. */
export function itemLink(item, userRecipes) {
  if (item.is_exercise && item.polar_session_id) return { polar: true };
  const recipe = userRecipes.find((r) => r.name === item.recipe_name);
  return recipe ? { recipe } : null;
}
