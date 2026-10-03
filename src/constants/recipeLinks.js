// src/constants/recipeLinks.js — saved recipes used as ingredients of other recipes
//
// An ingredient whose name matches a saved recipe (case/space-insensitive) is
// "linked": its nutrition comes from that recipe's per-portion nutrition,
// scaled by grams ÷ Wt/portion (or by number of portions), instead of Claude.
export const MACROS = ["kcal","fat","sat_fat","carbs","sugar","fibre","net_carbs","protein"];

export const normRecipeName = v => String(v ?? "").toLowerCase().trim().replace(/\s+/g, " ");

const GRAM_UNITS = { g:1, gm:1, gms:1, gr:1, gram:1, grams:1, kg:1000, kgs:1000, oz:28.3495, ounce:28.3495, ounces:28.3495 };
const PORTION_UNITS = new Set(["", "portion", "portions", "serving", "servings", "serve", "serves", "x"]);

// "250g", "0.25 kg", "~60 g", "8 oz" → { grams }; "1 portion", "2 servings", "1.5" → { portions }
export function parseAmount(s) {
  const m = String(s ?? "").trim().toLowerCase().match(/^~?\s*(\d+(?:\.\d+)?|\.\d+)\s*([a-z]*)\.?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!(n > 0)) return null;
  if (GRAM_UNITS[m[2]] != null) return { grams: n * GRAM_UNITS[m[2]] };
  if (PORTION_UNITS.has(m[2])) return { portions: n };
  return null;
}

export function findLinkedRecipe(item, recipes, selfId) {
  const q = normRecipeName(item);
  if (!q) return null;
  return (recipes || []).find(r => r.id !== selfId && normRecipeName(r.name) === q) || null;
}

// null = not a saved recipe; { ok:false, recipe, reason } = can't be used as-is;
// { ok:true, recipe, factor, grams (null if unknown), nutrition (scaled, unrounded) }
export function linkInfo(ing, recipes, selfId) {
  const recipe = findLinkedRecipe(ing?.item, recipes, selfId);
  if (!recipe) return null;
  const amt = parseAmount(ing.amount);
  if (!amt) return { ok:false, recipe, reason:"use an amount in g, kg, oz or portions" };
  const pg = Number(recipe.portion_g) > 0 ? Number(recipe.portion_g) : null;
  let factor, grams;
  if (amt.grams != null) {
    if (!pg) return { ok:false, recipe, reason:`${recipe.name} has no Wt/portion yet — use portions` };
    factor = amt.grams / pg; grams = amt.grams;
  } else {
    factor = amt.portions; grams = pg ? amt.portions * pg : null;
  }
  const base = recipe.nutrition || {};
  return { ok:true, recipe, factor, grams, nutrition: Object.fromEntries(MACROS.map(k => [k, (Number(base[k]) || 0) * factor])) };
}

// Usable linked ingredients vs everything else (blank rows dropped)
export function splitIngredients(recipe, recipes) {
  const linked = [], other = [];
  for (const ing of recipe?.ingredients || []) {
    if (!String(ing.amount ?? "").trim() && !String(ing.item ?? "").trim()) continue;
    const li = linkInfo(ing, recipes, recipe.id);
    if (li?.ok) linked.push({ ing, ...li }); else other.push(ing);
  }
  return { linked, other };
}

// Per-serving nutrition: (linked totals + other-ingredient totals) ÷ servings, 1 dp
export function combineNutrition(linked, otherTotal, servings) {
  const s = Number(servings) > 0 ? Number(servings) : 1;
  return Object.fromEntries(MACROS.map(k => {
    const t = linked.reduce((acc, l) => acc + l.nutrition[k], 0) + (Number(otherTotal?.[k]) || 0);
    return [k, Math.round(t / s * 10) / 10];
  }));
}

// ── Keeping dependent recipes up to date ─────────────────────────────────────
// When saved recipe A changes (oldA → newA; oldA null for a new recipe), each
// recipe B with an ingredient named oldA.name or newA.name is affected.
// Renamed A → B's ingredient is renamed too, so the link holds.
export function relinkDependent(B, oldA, newA, recipesOld, recipesNew) {
  const oldName = normRecipeName(oldA?.name), newName = normRecipeName(newA?.name);
  const rows = [];
  const ingredients = (B?.ingredients || []).map(ing => {
    const n = normRecipeName(ing.item);
    if (!n || (n !== oldName && n !== newName)) return ing;
    const newIng = oldA && n === oldName && oldName !== newName ? { ...ing, item: newA.name } : ing;
    rows.push({ oldLi: oldA ? linkInfo(ing, recipesOld, B.id) : null, newLi: linkInfo(newIng, recipesNew, B.id) });
    return newIng;
  });
  return { ingredients, rows, deltaOk: rows.length > 0 && rows.every(r => r.oldLi?.ok && r.newLi?.ok) };
}

// B's new per-serving nutrition = old + (new A contribution − old) ÷ servings.
// weight: {} = leave as is, {portion_g, …} = adjusted estimate, null = needs re-estimating.
export function applyLinkDelta(B, rows, { keepWeight = false } = {}) {
  const s = Number(B.servings) > 0 ? Number(B.servings) : 1;
  const base = B.nutrition || {};
  const nutrition = Object.fromEntries(MACROS.map(k => {
    const d = rows.reduce((t, r) => t + r.newLi.nutrition[k] - r.oldLi.nutrition[k], 0);
    return [k, Math.round(((Number(base[k]) || 0) + d / s) * 10) / 10];
  }));
  let weight;
  if (keepWeight) weight = {};
  else if (Number(B.portion_g) > 0 && rows.every(r => r.oldLi.grams != null && r.newLi.grams != null)) {
    const g = Math.round(Number(B.portion_g) + rows.reduce((t, r) => t + r.newLi.grams - r.oldLi.grams, 0) / s);
    weight = g > 0 ? { portion_g: g, portion_g_source: "estimated" } : null;
  } else weight = null;
  return { nutrition, weight };
}
