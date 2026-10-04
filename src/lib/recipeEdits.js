// src/lib/recipeEdits.js — edits made in the recipe builder's form. Each takes the recipe
// being edited and returns the changed copy (for builder.setPreview(fn)).

/** Any plain field (name, description, prep_time, cook_time, notes). */
export const withField = (recipe, key, value) => ({ ...recipe, [key]: value });

/** Servings typed in; anything that isn't a non-zero number is left blank. */
export const withServings = (recipe, text) => ({ ...recipe, servings: Number(text) || "" });

/** A typed Wt/portion is the user's ("weighed"); blank, zero or invalid clears it. */
export function withWeighedPortion(recipe, text) {
  const grams = parseFloat(text);
  const ok = Number.isFinite(grams) && grams > 0;
  return { ...recipe, portion_g: ok ? grams : null, portion_g_source: ok ? "weighed" : null };
}

/** One nutrition value typed in; invalid → 0. */
export const withMacro = (recipe, key, text) => ({
  ...recipe,
  nutrition: { ...(recipe.nutrition || {}), [key]: Number(text) || 0 },
});

const replaceAt = (list, index, value) => list.map((x, j) => (j === index ? value : x));
const removeAt = (list, index) => list.filter((_, j) => j !== index);

/** field: "amount" or "item". */
export const withIngredient = (recipe, index, { field, value }) => ({
  ...recipe,
  ingredients: replaceAt(recipe.ingredients, index, {
    ...recipe.ingredients[index],
    [field]: value,
  }),
});
export const withoutIngredient = (recipe, index) => ({
  ...recipe,
  ingredients: removeAt(recipe.ingredients, index),
});
export const withNewIngredient = (recipe) => ({
  ...recipe,
  ingredients: [...(recipe.ingredients || []), { amount: "", item: "" }],
});

export const withStep = (recipe, index, text) => ({
  ...recipe,
  steps: replaceAt(recipe.steps, index, text),
});
export const withoutStep = (recipe, index) => ({ ...recipe, steps: removeAt(recipe.steps, index) });
export const withNewStep = (recipe) => ({ ...recipe, steps: [...(recipe.steps || []), ""] });

/** Saved recipes offered as ingredient names (never the recipe itself). */
export const linkableRecipes = (recipes, selfId) => recipes.filter((r) => r.id !== selfId);

const portionsText = (factor) => `${+factor.toFixed(2)} portion${factor === 1 ? "" : "s"}`;

/**
 * Text under an ingredient row that names a saved recipe (linkInfo result), or null.
 * ok: "📖 Saved recipe · 250 g · 0.76 portions · 258 kcal"; not ok: the reason.
 */
export function linkBadgeText(link) {
  if (!link) return null;
  if (!link.ok) return `📖 Saved recipe — ${link.reason}; Claude will estimate it instead`;
  const grams = link.grams != null ? `${Math.round(link.grams)} g · ` : "";
  return `📖 Saved recipe · ${grams}${portionsText(link.factor)} · ${Math.round(link.nutrition.kcal)} kcal`;
}
