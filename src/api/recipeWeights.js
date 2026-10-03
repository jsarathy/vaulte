// src/api/recipeWeights.js — estimated Wt/portion for saved recipes
//
// portion_g          weight of one portion in grams
// portion_g_source   "estimated" = sum of ingredient weights ÷ servings (from
//                    Claude, no allowance for cooking losses); anything else
//                    with a portion_g (typed in / weighed) is the user's value
//                    and is never overwritten.
import { saveRecipe } from "./firestore";
import { claudeEstimatePortionWeight, claudeRecalculateNutrition } from "./claude";
import { splitIngredients, combineNutrition, relinkDependent, applyLinkDelta } from "../constants/recipeLinks";

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

// After saved recipe A changes (oldA → newA; oldA null if new), update every
// recipe that uses it, then their dependents in turn. Uses the difference in
// A's contribution where both old and new links are usable (no Claude call);
// otherwise recalculates the recipe in full. Each recipe is saved as it's done.
// recipesNew: the recipe list including newA. Returns { list, updated: [names] }.
export async function propagateRecipeChange(uid, oldA, newA, recipesNew, setUserRecipes, path = new Set()) {
  const onPath = new Set(path).add(newA.id);
  let list = recipesNew;
  const recipesOld = oldA ? list.map(r => r.id === newA.id ? oldA : r) : list.filter(r => r.id !== newA.id);
  const updated = [];
  for (const id of list.map(r => r.id)) {
    if (onPath.has(id)) continue;                       // never itself, no cycles
    const B = list.find(r => r.id === id);              // latest copy (may have been updated deeper down)
    const { ingredients, rows, deltaOk } = relinkDependent(B, oldA, newA, recipesOld, list);
    if (!rows.length) continue;
    const keepWeight = hasPortionWeight(B) && !isEstimatedWeight(B);
    const B1 = { ...B, ingredients };
    let fields;
    if (deltaOk) {
      const { nutrition, weight } = applyLinkDelta(B, rows, { keepWeight });
      fields = { nutrition, ...(weight ?? ((await estimatePortionWeight(B1, list)) || {})) };
    } else {
      fields = await computeRecipeFields(B1, list, { keepWeight });
    }
    const B2 = { ...B1, ...fields };
    await saveRecipe(uid, B2);
    list = list.map(r => r.id === B2.id ? B2 : r);
    setUserRecipes(prev => prev.map(r => r.id === B2.id ? B2 : r));
    updated.push(B2.name);
    const deeper = await propagateRecipeChange(uid, B, B2, list, setUserRecipes, onPath);
    list = deeper.list; updated.push(...deeper.updated);
  }
  return { list, updated };
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
      // Recipes built on this one may now link properly (grams need a Wt/portion)
      await propagateRecipeChange(uid, latest, updated, getRecipes().map(x => x.id === updated.id ? updated : x), setUserRecipes)
        .catch(e => console.error("dependent recipe update failed", e));
    }
  } catch (e) {
    console.error("portion weight backfill failed", e);
  } finally {
    running = false;
  }
}
