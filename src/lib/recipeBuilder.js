// src/lib/recipeBuilder.js — the recipe builder (create with Claude / edit a saved recipe).
import { MACROS, findNameClash } from "../constants/recipeLinks.js";

/**
 * What a recipe's nutrition was calculated from: servings + non-blank ingredient rows
 * (trimmed). When it differs from the key saved with the nutrition, Save recalculates.
 */
export const nutritionKey = (recipe) =>
  JSON.stringify({
    s: Number(recipe?.servings) || 0,
    i: (recipe?.ingredients || [])
      .map((x) => [String(x.amount || "").trim(), String(x.item || "").trim()])
      .filter(([amount, item]) => amount || item),
  });

/** A deep copy to edit, so the saved recipe isn't changed until Save. */
export const editorCopy = (recipe) => JSON.parse(JSON.stringify(recipe));

/** Why the recipe can't be saved under its name, or null. */
export function nameProblem(recipe, recipes) {
  if (!String(recipe.name || "").trim()) return "Give the recipe a name.";
  const clash = findNameClash(recipe.name, recipes, recipe.id);
  return clash ? `A saved recipe is already called "${clash.name}" — choose another name.` : null;
}

/** Claude's new recipe with an id; its portion weight rounded and marked estimated. */
export function prepareGenerated(recipe, id) {
  const grams = Math.round(Number(recipe.portion_g));
  return grams > 0
    ? { ...recipe, id, portion_g: grams, portion_g_source: "estimated" }
    : { ...recipe, id, portion_g: null };
}

/** The saved list with `recipe` added or replaced, sorted by name. */
export const upsertSorted = (recipes, recipe) =>
  [...recipes.filter((r) => r.id !== recipe.id), recipe].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

const plural = (n, word) => `${word}${n === 1 ? "" : "s"}`;

/** Notice after saving: which recipes built on this one were updated (null if none). */
export const dependentsNotice = (names) =>
  names.length
    ? {
        ok: true,
        text: `Also updated ${names.length} ${plural(names.length, "recipe")} that use${names.length === 1 ? "s" : ""} it: ${names.join(", ")}`,
      }
    : null;

export const dependentsFailedNotice = (err) => ({
  ok: false,
  text: `Saved, but couldn't update recipes that use it (${err.message || "error"}) — open them and save to recalculate.`,
});

/** The Add Food form filled with a new recipe's per-serving nutrition (0 shows blank). */
export const formItemFromRecipe = (recipe) => ({
  name: recipe.name,
  ...Object.fromEntries(MACROS.map((k) => [k, (recipe.nutrition || {})[k] || ""])),
});

/** Save button text. */
export function saveLabel({ saving, stale, editing }) {
  if (saving) return stale ? "⏳ Recalculating & saving…" : "⏳ Saving…";
  return editing ? "✓ Save Changes" : "✓ Save Recipe";
}

export const ERRORS = {
  generate: "Could not parse recipe. Try adding more detail about ingredients and quantities.",
  save: "Could not save recipe.",
  recalc: "Could not recalculate nutrition.",
};
