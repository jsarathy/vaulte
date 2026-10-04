// src/lib/savedRecipes.js — texts for the Saved Recipes list (Fix 23 delete cascade, Fix 20 weights).

const plural = (n, word) => `${word}${n === 1 ? "" : "s"}`;

/** Confirm text for deleting a recipe and the recipes built on it. */
export function deleteConfirmText(recipe, dependents) {
  if (!dependents.length) return `Delete "${recipe.name}"?`;
  const n = dependents.length;
  const names = dependents.map((d) => d.name).join("\n• ");
  return `Delete "${recipe.name}"?\n\nThis also deletes ${n} ${plural(n, "recipe")} that use${n === 1 ? "s" : ""} it:\n• ${names}\n\nFood already logged isn't affected.`;
}

/** Notice after deleting (null when nothing else went). */
export function deletedNotice(recipe, dependents) {
  if (!dependents.length) return null;
  const n = dependents.length;
  const names = dependents.map((d) => d.name).join(", ");
  return {
    ok: true,
    text: `Deleted ${recipe.name} and ${n} ${plural(n, "recipe")} that used it: ${names}`,
  };
}

/** "225 g", "225 g (est.)", or null when the recipe has no Wt/portion. */
export const weightLabel = (recipe, estimated) =>
  recipe.portion_g != null ? `${recipe.portion_g} g${estimated ? " (est.)" : ""}` : null;

/** The list without the deleted recipes. */
export const withoutRecipes = (recipes, gone) => {
  const ids = new Set(gone.map((r) => r.id));
  return recipes.filter((r) => !ids.has(r.id));
};
