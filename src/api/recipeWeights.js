// src/api/recipeWeights.js — estimated Wt/portion for saved recipes
//
// portion_g          weight of one portion in grams
// portion_g_source   "estimated" = sum of ingredient weights ÷ servings (from
//                    Claude, no allowance for cooking losses); anything else
//                    with a portion_g (typed in / weighed) is the user's value
//                    and is never overwritten.
import { saveRecipe } from "./firestore";
import { claudeEstimatePortionWeight, claudeRecalculateNutrition } from "./claude";
import { splitIngredients, combineNutrition } from "../constants/recipeLinks";

export const hasPortionWeight = r => Number(r?.portion_g) > 0;
export const isEstimatedWeight = r => hasPortionWeight(r) && r.portion_g_source === "estimated";
const contentKey = r => JSON.stringify([Number(r?.servings) || 0, r?.ingredients || []]);

// Fields to merge into a recipe, or null if the estimate fails / is unusable.
// Saved recipes used as ingredients count at their own weight; Claude only
// weighs the rest.
export async function estimatePortionWeight(recipe, recipes = []) {
  try {
    const { linked, other } = splitIngredients(recipe, recipes);
    let portion_g;
    if (!linked.length) {
      ({ portion_g } = await claudeEstimatePortionWeight(recipe));
    } else {
      // Linked recipes with no known weight are weighed by Claude with the rest
      const known = linked.filter(l => l.grams != null);
      const toWeigh = [...other, ...linked.filter(l => l.grams == null).map(l => l.ing)];
      const rest = toWeigh.length ? Number((await claudeEstimatePortionWeight({ name: recipe.name, servings: 1, ingredients: toWeigh })).total_g) : 0;
      if (!Number.isFinite(rest)) return null;
      portion_g = (known.reduce((t, l) => t + l.grams, 0) + rest) / (Number(recipe.servings) > 0 ? Number(recipe.servings) : 1);
    }
    const g = Math.round(Number(portion_g));
    return g > 0 ? { portion_g: g, portion_g_source: "estimated" } : null;
  } catch (e) {
    console.error("portion weight estimate failed for", recipe?.name, e);
    return null;
  }
}

// Nutrition per serving (and, unless keepWeight, an estimated Wt/portion) for a
// recipe. Linked saved-recipe ingredients use their own nutrition; Claude
// only calculates the other ingredients.
export async function computeRecipeFields(recipe, recipes = [], { keepWeight = false } = {}) {
  const { linked, other } = splitIngredients(recipe, recipes);
  let nutrition;
  if (!linked.length) {
    nutrition = await claudeRecalculateNutrition(recipe);
  } else {
    const otherTotal = other.length ? await claudeRecalculateNutrition({ servings: 1, ingredients: other }) : null;
    nutrition = combineNutrition(linked, otherTotal, recipe.servings);
  }
  const weight = keepWeight ? null : await estimatePortionWeight(recipe, recipes);
  return { nutrition, ...(weight || {}) };
}

// One-off fill-in for saved recipes with no Wt/portion. Runs once per page
// load; each recipe is saved as soon as its estimate arrives. A recipe edited
// meanwhile (or given a weight) is skipped and picked up on a later load.
let running = false;
export async function backfillPortionWeights(uid, getRecipes, setUserRecipes) {
  if (running) return;
  running = true;
  try {
    for (const r of getRecipes().filter(x => !hasPortionWeight(x))) {
      const w = await estimatePortionWeight(r, getRecipes());
      if (!w) continue;
      const latest = getRecipes().find(x => x.id === r.id);
      if (!latest || hasPortionWeight(latest) || contentKey(latest) !== contentKey(r)) continue;
      const updated = { ...latest, ...w };
      await saveRecipe(uid, updated);
      setUserRecipes(prev => prev.map(x => x.id === updated.id && !hasPortionWeight(x) ? updated : x));
    }
  } catch (e) {
    console.error("portion weight backfill failed", e);
  } finally {
    running = false;
  }
}
