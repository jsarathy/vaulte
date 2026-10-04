// src/api/recipeWeights.js — estimated Wt/portion for saved recipes
//
// portion_g          weight of one portion in grams
// portion_g_source   "estimated" = sum of ingredient weights ÷ servings (from
//                    Claude, no allowance for cooking losses); anything else
//                    with a portion_g (typed in / weighed) is the user's value
//                    and is never overwritten.
import { saveRecipe } from "./firestore";
import { claudeEstimatePortionWeight, claudeRecalculateNutrition } from "./claude";
import {
  splitIngredients,
  combineNutrition,
  relinkDependent,
  applyLinkDelta,
  servingCount,
} from "../constants/recipeLinks";

export const hasPortionWeight = (r) => Number(r?.portion_g) > 0;
export const isEstimatedWeight = (r) => hasPortionWeight(r) && r.portion_g_source === "estimated";
const contentKey = (r) => JSON.stringify([Number(r?.servings) || 0, r?.ingredients || []]);
const replaceById = (list, recipe) => list.map((r) => (r.id === recipe.id ? recipe : r));

const estimatedWeight = (grams) => {
  const g = Math.round(Number(grams));
  return g > 0 ? { portion_g: g, portion_g_source: "estimated" } : null;
};

// Claude's total weight (g) of some ingredients, treated as one batch
async function claudeTotalGrams(name, ingredients) {
  if (!ingredients.length) return 0;
  const { total_g } = await claudeEstimatePortionWeight({ name, servings: 1, ingredients });
  return Number(total_g);
}

// Grams per portion. Saved recipes used as ingredients count at their own
// weight; Claude weighs the rest (and linked recipes with no known weight).
async function portionGrams(recipe, recipes) {
  const { linked, other } = splitIngredients(recipe, recipes);
  if (!linked.length) return (await claudeEstimatePortionWeight(recipe)).portion_g;
  const known = linked.filter((l) => l.grams != null);
  const unknown = linked.filter((l) => l.grams == null).map((l) => l.ing);
  const rest = await claudeTotalGrams(recipe.name, [...other, ...unknown]);
  if (!Number.isFinite(rest)) return null;
  return (known.reduce((t, l) => t + l.grams, 0) + rest) / servingCount(recipe.servings);
}

// Fields to merge into a recipe, or null if the estimate fails / is unusable.
export async function estimatePortionWeight(recipe, recipes = []) {
  try {
    return estimatedWeight(await portionGrams(recipe, recipes));
  } catch (e) {
    console.error("portion weight estimate failed for", recipe?.name, e);
    return null;
  }
}

// Linked saved-recipe ingredients use their own nutrition; Claude only
// calculates the other ingredients.
async function nutritionPerServing(recipe, recipes) {
  const { linked, other } = splitIngredients(recipe, recipes);
  if (!linked.length) return claudeRecalculateNutrition(recipe);
  const otherTotal = other.length
    ? await claudeRecalculateNutrition({ servings: 1, ingredients: other })
    : null;
  return combineNutrition(linked, otherTotal, recipe.servings);
}

// Nutrition per serving (and, unless keepWeight, an estimated Wt/portion) for a recipe.
export async function computeRecipeFields(recipe, recipes = [], { keepWeight = false } = {}) {
  const nutrition = await nutritionPerServing(recipe, recipes);
  const weight = keepWeight ? null : await estimatePortionWeight(recipe, recipes);
  return { nutrition, ...(weight || {}) };
}

// ── Keeping dependent recipes up to date ─────────────────────────────────────
// ctx = { uid, setUserRecipes }; change = { oldA, newA, list } (list includes newA).

// The recipe list as it was before A changed
const recipesBefore = ({ oldA, newA, list }) =>
  oldA ? list.map((r) => (r.id === newA.id ? oldA : r)) : list.filter((r) => r.id !== newA.id);

// Exact difference where both of A's links are usable (no Claude call), else a
// full recalculation. A weighed Wt/portion is kept.
async function dependentFields(B1, relink, list) {
  const keepWeight = hasPortionWeight(B1) && !isEstimatedWeight(B1);
  if (!relink.deltaOk) return computeRecipeFields(B1, list, { keepWeight });
  const { nutrition, weight } = applyLinkDelta(B1, relink.rows, { keepWeight });
  return { nutrition, ...(weight ?? ((await estimatePortionWeight(B1, list)) || {})) };
}

// Update one recipe B if it uses A, save it, then B's own dependents.
async function updateDependent(ctx, B, step) {
  const { oldA, newA, recipesOld, list } = step;
  const relink = relinkDependent(B, { oldA, newA, recipesOld, recipesNew: list });
  if (!relink.rows.length) return { list, updated: [] };
  const B1 = { ...B, ingredients: relink.ingredients };
  const B2 = { ...B1, ...(await dependentFields(B1, relink, list)) };
  await saveRecipe(ctx.uid, B2);
  ctx.setUserRecipes((prev) => replaceById(prev, B2));
  const deeper = await propagate(
    ctx,
    { oldA: B, newA: B2, list: replaceById(list, B2) },
    step.onPath,
  );
  return { list: deeper.list, updated: [B2.name, ...deeper.updated] };
}

// onPath: recipes already being updated up the chain — never revisited, so cycles end.
async function propagate(ctx, change, path) {
  const onPath = new Set(path).add(change.newA.id);
  const recipesOld = recipesBefore(change);
  let list = change.list;
  const updated = [];
  for (const id of change.list.map((r) => r.id)) {
    if (onPath.has(id)) continue;
    const B = list.find((r) => r.id === id); // latest copy (may have been updated deeper down)
    const result = await updateDependent(ctx, B, { ...change, recipesOld, list, onPath });
    list = result.list;
    updated.push(...result.updated);
  }
  return { list, updated };
}

// After saved recipe A changes (oldA → newA; oldA null if new), update every
// recipe that uses it, then their dependents in turn. Each recipe is saved as
// it's done. recipes: the recipe list including newA. Returns { list, updated: [names] }.
export async function propagateRecipeChange({ uid, oldA, newA, recipes, setUserRecipes }) {
  return propagate({ uid, setUserRecipes }, { oldA, newA, list: recipes }, new Set());
}

// ── Wt/portion backfill ──────────────────────────────────────────────────────
// The recipe as it is now, unless it was edited (or given a weight) meanwhile
function unchangedSince(getRecipes, r) {
  const latest = getRecipes().find((x) => x.id === r.id);
  if (!latest || hasPortionWeight(latest) || contentKey(latest) !== contentKey(r)) return null;
  return latest;
}

// ctx = { uid, getRecipes, setUserRecipes }
async function backfillOne(ctx, r) {
  const w = await estimatePortionWeight(r, ctx.getRecipes());
  const latest = w && unchangedSince(ctx.getRecipes, r);
  if (!latest) return;
  const updated = { ...latest, ...w };
  await saveRecipe(ctx.uid, updated);
  ctx.setUserRecipes((prev) =>
    prev.map((x) => (x.id === updated.id && !hasPortionWeight(x) ? updated : x)),
  );
  // Recipes built on this one may now link properly (grams need a Wt/portion)
  const recipes = replaceById(ctx.getRecipes(), updated);
  await propagateRecipeChange({ ...ctx, oldA: latest, newA: updated, recipes }).catch((e) =>
    console.error("dependent recipe update failed", e),
  );
}

// One-off fill-in for saved recipes with no Wt/portion. Runs once per page
// load; each recipe is saved as soon as its estimate arrives. A recipe edited
// meanwhile (or given a weight) is skipped and picked up on a later load.
let running = false;
export async function backfillPortionWeights(uid, getRecipes, setUserRecipes) {
  if (running) return;
  running = true;
  const ctx = { uid, getRecipes, setUserRecipes };
  try {
    for (const r of getRecipes().filter((x) => !hasPortionWeight(x))) await backfillOne(ctx, r);
  } catch (e) {
    console.error("portion weight backfill failed", e);
  } finally {
    running = false;
  }
}
