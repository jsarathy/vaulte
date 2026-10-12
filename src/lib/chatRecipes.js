// src/lib/chatRecipes.js — the chat's recipe lookup (Fix 88): Claude asks for a saved recipe with
// the find_recipes tool, and this finds it on the device. The recipes are not sent with every
// message any more.

export const FIND_RECIPES_TOOL = {
  name: "find_recipes",
  description:
    "Look up the user's saved recipes by words from a recipe's name or ingredients. Returns up to 5 matching recipes (name, description, servings, ingredients, steps, nutrition per serving). If nothing matches it returns the names of all saved recipes so you can try again.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Words from the recipe's name or ingredients" },
    },
    required: ["query"],
  },
};

const MAX_MATCHES = 5;
const SKIP = new Set(["the", "and", "for", "with", "recipe", "recipes"]);

const words = (query) =>
  String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !SKIP.has(w));

const forChat = (r) => ({
  name: r.name,
  description: r.description,
  servings: r.servings,
  ingredients: r.ingredients,
  steps: r.steps,
  nutrition: r.nutrition,
});

/** A name hit counts 3, an ingredient hit 1, summed over the query's words. */
function score(recipe, ws) {
  const name = String(recipe.name || "").toLowerCase();
  const ingredients = JSON.stringify(recipe.ingredients || []).toLowerCase();
  return ws.reduce((s, w) => s + (name.includes(w) ? 3 : 0) + (ingredients.includes(w) ? 1 : 0), 0);
}

/** What the tool answers: the best matches, or (none matched) the names to try again with. */
export function findRecipes(recipes, query) {
  const ws = words(query);
  const matches = recipes
    .map((r) => ({ r, s: score(r, ws) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_MATCHES)
    .map((x) => forChat(x.r));
  return matches.length
    ? { matches }
    : { matches: [], saved_recipe_names: recipes.map((r) => r.name) };
}
