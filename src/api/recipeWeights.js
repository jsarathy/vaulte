// src/api/recipeWeights.js — estimated Wt/portion for saved recipes
//
// portion_g          weight of one portion in grams
// portion_g_source   "estimated" = sum of ingredient weights ÷ servings (from
//                    Claude, no allowance for cooking losses); anything else
//                    with a portion_g (typed in / weighed) is the user's value
//                    and is never overwritten.
import { saveRecipe } from "./firestore";
import { claudeEstimatePortionWeight } from "./claude";

export const hasPortionWeight = r => Number(r?.portion_g) > 0;
export const isEstimatedWeight = r => hasPortionWeight(r) && r.portion_g_source === "estimated";
const contentKey = r => JSON.stringify([Number(r?.servings) || 0, r?.ingredients || []]);

// Fields to merge into a recipe, or null if the estimate fails / is unusable.
export async function estimatePortionWeight(recipe) {
  try {
    const { portion_g } = await claudeEstimatePortionWeight(recipe);
    const g = Math.round(Number(portion_g));
    return g > 0 ? { portion_g: g, portion_g_source: "estimated" } : null;
  } catch (e) {
    console.error("portion weight estimate failed for", recipe?.name, e);
    return null;
  }
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
      const w = await estimatePortionWeight(r);
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
