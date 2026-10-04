// src/lib/recipePortion.js — the "How much?" box for adding a saved recipe (Fixes 19–20).
// Portions are always scaled on the device; grams / ounces too when the recipe has a
// Wt/portion. Anything else (ml, or no Wt/portion) is worked out by Claude.
import { MACROS } from "../constants/recipeLinks.js";

export const PORTION_UNITS = [
  ["portion", "portion(s)"],
  ["g", "grams (g)"],
  ["ml", "millilitres (ml)"],
  ["oz", "ounces (oz)"],
];
const GRAMS_PER_UNIT = { g: 1, oz: 28.3495 };

/** Quantity typed in the box; blank, zero or invalid counts as 1. */
export const parseQty = (text) => parseFloat(text) || 1;

/** Weight of one portion in grams, or null if the recipe has none. */
export const portionWeight = (recipe) =>
  parseFloat(recipe.portion_g) > 0 ? parseFloat(recipe.portion_g) : null;

/** Multiple of one serving, worked out on the device; null = needs Claude. */
export function localFactor(recipe, qty, unit) {
  if (unit === "portion") return qty;
  const grams = portionWeight(recipe);
  return grams && GRAMS_PER_UNIT[unit] ? (qty * GRAMS_PER_UNIT[unit]) / grams : null;
}

/** Every macro × factor, to 1 dp; a missing macro counts as 0. */
export const scaleMacros = (nutrition, factor) =>
  Object.fromEntries(MACROS.map((k) => [k, +((Number(nutrition?.[k]) || 0) * factor).toFixed(1)]));

const portionsWord = (qty) => `portion${qty !== 1 ? "s" : ""}`;

/** "2 portions of" / "150 g of" — heading of the scaled preview. */
export const amountHeading = (qty, unit) =>
  `${qty} ${unit === "portion" ? portionsWord(qty) : unit} of`;

/** "(2 portions)" / "(150g)" — added to the food name. */
export const amountSuffix = (qty, unit) =>
  unit === "portion" ? `(${qty} ${portionsWord(qty)})` : `(${qty}${unit})`;

/**
 * What the box shows for the current inputs.
 * claudeResult: Claude's scaled macros (null until calculated).
 */
export function portionView(recipe, { qtyText, unit, claudeResult }) {
  const qty = parseQty(qtyText);
  const factor = localFactor(recipe, qty, unit);
  const isLocal = factor != null;
  return {
    qty,
    isLocal,
    scaled: isLocal ? scaleMacros(recipe.nutrition, factor) : claudeResult,
    heading: amountHeading(qty, unit),
    suffix: amountSuffix(qty, unit),
  };
}

/** "Per serving (base) · 225 g (est.)" */
export const baseHeading = (grams, estimated) =>
  `Per serving (base)${grams ? ` · ${grams} g${estimated ? " (est.)" : ""}` : ""}`;

export const claudeHint = (unit) =>
  unit === "ml"
    ? "Millilitres are worked out by Claude."
    : "This recipe has no Wt/portion, so Claude will estimate the portion weight.";

export const calcErrorText = (err) =>
  `Could not calculate (${err.message || "unknown error"}) — try portions, or add a Wt/portion to the recipe.`;

/** The Add Food form's fields for an amount of a recipe. */
export const formItemFor = (recipe, macros, suffix) => ({
  name: `${recipe.name} ${suffix}`,
  ...Object.fromEntries(MACROS.map((k) => [k, macros[k] ?? ""])),
});
