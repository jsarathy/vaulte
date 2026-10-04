// src/constants/recipeLinks.js — saved recipes used as ingredients of other recipes
//
// An ingredient whose name matches a saved recipe (case/space-insensitive) is
// "linked": its nutrition comes from that recipe's per-portion nutrition,
// scaled by grams ÷ Wt/portion (or by number of portions), instead of Claude.
export const MACROS = ["kcal", "fat", "sat_fat", "carbs", "sugar", "fibre", "net_carbs", "protein"];

export const normRecipeName = (v) =>
  String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

// Servings as a divisor: anything missing, zero or invalid counts as 1
export const servingCount = (servings) => (Number(servings) > 0 ? Number(servings) : 1);
const round1 = (n) => Math.round(n * 10) / 10;

const GRAM_UNITS = {
  g: 1,
  gm: 1,
  gms: 1,
  gr: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
};
const PORTION_UNITS = new Set([
  "",
  "portion",
  "portions",
  "serving",
  "servings",
  "serve",
  "serves",
  "x",
]);

// "250g", "0.25 kg", "~60 g", "8 oz" → { grams }; "1 portion", "2 servings", "1.5" → { portions }
export function parseAmount(s) {
  const m = String(s ?? "")
    .trim()
    .toLowerCase()
    .match(/^~?\s*(\d+(?:\.\d+)?|\.\d+)\s*([a-z]*)\.?$/);
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
  return (recipes || []).find((r) => r.id !== selfId && normRecipeName(r.name) === q) || null;
}

const portionWeightOf = (recipe) =>
  Number(recipe.portion_g) > 0 ? Number(recipe.portion_g) : null;

// How much of `recipe` an amount is: { factor (portions), grams (null if unknown) },
// or { reason } when grams are given but the recipe has no Wt/portion.
function scaleOf(amount, recipe) {
  const pg = portionWeightOf(recipe);
  if (amount.portions != null)
    return { factor: amount.portions, grams: pg ? amount.portions * pg : null };
  if (!pg) return { reason: `${recipe.name} has no Wt/portion yet — use portions` };
  return { factor: amount.grams / pg, grams: amount.grams };
}

const scaleNutrition = (nutrition, factor) =>
  Object.fromEntries(MACROS.map((k) => [k, (Number(nutrition?.[k]) || 0) * factor]));

// null = not a saved recipe; { ok:false, recipe, reason } = can't be used as-is;
// { ok:true, recipe, factor, grams (null if unknown), nutrition (scaled, unrounded) }
export function linkInfo(ing, recipes, selfId) {
  const recipe = findLinkedRecipe(ing?.item, recipes, selfId);
  if (!recipe) return null;
  const amount = parseAmount(ing.amount);
  if (!amount) return { ok: false, recipe, reason: "use an amount in g, kg, oz or portions" };
  const scale = scaleOf(amount, recipe);
  if (scale.reason) return { ok: false, recipe, reason: scale.reason };
  return { ok: true, recipe, ...scale, nutrition: scaleNutrition(recipe.nutrition, scale.factor) };
}

// Usable linked ingredients vs everything else (blank rows dropped)
export function splitIngredients(recipe, recipes) {
  const linked = [],
    other = [];
  for (const ing of recipe?.ingredients || []) {
    if (!String(ing.amount ?? "").trim() && !String(ing.item ?? "").trim()) continue;
    const li = linkInfo(ing, recipes, recipe.id);
    if (li?.ok) linked.push({ ing, ...li });
    else other.push(ing);
  }
  return { linked, other };
}

// Per-serving nutrition: (linked totals + other-ingredient totals) ÷ servings, 1 dp
export function combineNutrition(linked, otherTotal, servings) {
  const s = servingCount(servings);
  return Object.fromEntries(
    MACROS.map((k) => {
      const t = linked.reduce((acc, l) => acc + l.nutrition[k], 0) + (Number(otherTotal?.[k]) || 0);
      return [k, round1(t / s)];
    }),
  );
}

// ── Keeping dependent recipes up to date ─────────────────────────────────────
// When saved recipe A changes (oldA → newA; oldA null for a new recipe), each
// recipe B with an ingredient named oldA.name or newA.name is affected.
// change = { oldA, newA, recipesOld, recipesNew } (recipe lists before / after).
const refersToA = (name, { oldA, newA }) =>
  Boolean(name) && (name === normRecipeName(oldA?.name) || name === normRecipeName(newA?.name));
const isRenamedA = (name, { oldA, newA }) =>
  Boolean(oldA) && name === normRecipeName(oldA.name) && name !== normRecipeName(newA?.name);

// One ingredient of B: renamed if A was renamed (so the link holds), plus its old/new link
function relinkIngredient(ing, B, change) {
  const name = normRecipeName(ing.item);
  if (!refersToA(name, change)) return { ing };
  const newIng = isRenamedA(name, change) ? { ...ing, item: change.newA.name } : ing;
  const oldLi = change.oldA ? linkInfo(ing, change.recipesOld, B.id) : null;
  return { ing: newIng, row: { oldLi, newLi: linkInfo(newIng, change.recipesNew, B.id) } };
}

export function relinkDependent(B, change) {
  const results = (B?.ingredients || []).map((ing) => relinkIngredient(ing, B, change));
  const rows = results.filter((r) => r.row).map((r) => r.row);
  return {
    ingredients: results.map((r) => r.ing),
    rows,
    deltaOk: rows.length > 0 && rows.every((r) => r.oldLi?.ok && r.newLi?.ok),
  };
}

// Sum over B's rows of (new − old) for one value of A's link
const rowsDelta = (rows, pick) => rows.reduce((t, r) => t + pick(r.newLi) - pick(r.oldLi), 0);

function shiftedNutrition(B, rows) {
  const s = servingCount(B.servings);
  const base = B.nutrition || {};
  return Object.fromEntries(
    MACROS.map((k) => [
      k,
      round1((Number(base[k]) || 0) + rowsDelta(rows, (li) => li.nutrition[k]) / s),
    ]),
  );
}

// B's estimated weight moved by the gram difference; null = needs re-estimating
function shiftedWeight(B, rows) {
  if (!(Number(B.portion_g) > 0)) return null;
  if (!rows.every((r) => r.oldLi.grams != null && r.newLi.grams != null)) return null;
  const shift = rowsDelta(rows, (li) => li.grams) / servingCount(B.servings);
  const g = Math.round(Number(B.portion_g) + shift);
  return g > 0 ? { portion_g: g, portion_g_source: "estimated" } : null;
}

// B's new per-serving nutrition = old + (new A contribution − old) ÷ servings.
// weight: {} = leave as is, {portion_g, …} = adjusted estimate, null = needs re-estimating.
export function applyLinkDelta(B, rows, { keepWeight = false } = {}) {
  return {
    nutrition: shiftedNutrition(B, rows),
    weight: keepWeight ? {} : shiftedWeight(B, rows),
  };
}

// Every recipe that uses `recipe` as an ingredient (by name), directly or via
// another recipe — deleted along with it so nothing is left half-defined.
// If another recipe has the same name (a duplicate), the dependents still have
// it to link to, so nothing else is deleted.
const usesRecipeNamed = (r, name) =>
  (r.ingredients || []).some((i) => normRecipeName(i.item) === name);

export function findDependentsDeep(recipe, recipes) {
  if (findNameClash(recipe.name, recipes, recipe.id)) return [];
  const out = [];
  const seen = new Set([recipe.id]);
  const queue = [recipe];
  while (queue.length) {
    const name = normRecipeName(queue.shift().name);
    const found = (recipes || []).filter((r) => !seen.has(r.id) && usesRecipeNamed(r, name));
    found.forEach((r) => seen.add(r.id));
    out.push(...found);
    queue.push(...found);
  }
  return out;
}

// Another saved recipe (not `selfId`) with the same name, ignoring case/spaces
export const findNameClash = (name, recipes, selfId) => findLinkedRecipe(name, recipes, selfId);
