// src/lib/foodLookup.js — "Get Nutrition": Claude looks up a food that isn't a saved recipe.
// A cooked dish is sent to the recipe builder instead; a single food fills the Add Food form
// and can be saved to Saved recipes as one portion.
import { MACROS, normRecipeName } from "../constants/recipeLinks.js";

export const LOOKUP_UNITS = [
  ["portion", "portion(s)"],
  ["g", "grams (g)"],
  ["ml", "millilitres (ml)"],
  ["oz", "ounces (oz)"],
  ["cup", "cup(s)"],
  ["tbsp", "tablespoon(s)"],
  ["tsp", "teaspoon(s)"],
];

/** Quantity typed in the box; blank, zero or invalid counts as 1. */
export const parseQty = (text) => parseFloat(text) || 1;

/** "2 portions", "1 portion", "150 g" */
export const amountText = (qty, unit) =>
  `${qty} ${unit === "portion" ? `portion${qty !== 1 ? "s" : ""}` : unit}`;

export function lookupPrompt({ name, qty, unit }) {
  return `First decide: is "${name}" a single food eaten as-is (apple, raw carrots, milk, chicken breast, a slice of toast) or a cooked/prepared dish that needs a recipe (stew, curry, pasta bake)?
If it is a DISH, reply with ONLY: {"kind":"DISH"}
Otherwise give the nutrition for ${amountText(qty, unit)} of "${name}". Reply with ONLY a JSON object, no markdown, no explanation:
{"kind":"INGREDIENT","display_name":"${name} (${qty} ${unit})","kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}
Use realistic values. For portions use a typical serving size.`;
}

/** Claude's reply (API response body) → the JSON object it contains; throws if none. */
export function parseLookupReply(data) {
  const text = (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

export const isDish = (reply) => String(reply.kind || "").toUpperCase() === "DISH";

/** The Add Food form filled from Claude's reply (missing values blank). */
export const formItemFromLookup = (reply, { name, qty, unit }) => ({
  name: reply.display_name || `${name} (${qty} ${unit})`,
  ...Object.fromEntries(MACROS.map((k) => [k, reply[k] ?? ""])),
});

// Saved as 1 portion: portions → divide by qty; any other unit → 1 portion = the amount entered
function perPortion(reply, { qty, unit }) {
  const per = unit === "portion" ? qty : 1;
  const value = (k) => {
    const v = Number(reply[k]);
    return Number.isFinite(v) ? Math.round((v / per) * 10) / 10 : 0;
  };
  return Object.fromEntries(MACROS.map((k) => [k, value(k)]));
}

/** The saved recipe for a looked-up food (grams → its Wt/portion). */
export function recipeFromLookup(reply, { name, qty, unit, id }) {
  return {
    id,
    name,
    description: "",
    source: "Get Nutrition",
    servings: 1,
    prep_time: "",
    cook_time: "",
    ingredients: [{ amount: unit === "portion" ? "1 portion" : `${qty} ${unit}`, item: name }],
    steps: [],
    notes: "",
    nutrition: perPortion(reply, { qty, unit }),
    ...(unit === "g" ? { portion_g: qty } : {}),
  };
}

/** Saved recipes with this name (case/space-insensitive), in list order. */
export const sameNameRecipes = (recipes, name) =>
  recipes.filter((r) => normRecipeName(r.name) === normRecipeName(name));

/** The list without any recipe of this name. */
export const withoutName = (recipes, name) =>
  recipes.filter((r) => normRecipeName(r.name) !== normRecipeName(name));

/** The list with `recipe` replacing every recipe of its name, sorted by name. */
export const replaceByNameSorted = (recipes, recipe) =>
  [...withoutName(recipes, recipe.name), recipe].sort((a, b) => a.name.localeCompare(b.name));
