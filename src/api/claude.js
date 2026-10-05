// src/api/claude.js — the Claude calls the app makes: parsing food, creating / recalculating /
// scaling / regenerating recipes, estimating a portion weight, and the chat. Each sends a system
// prompt (claudePrompts.js) and the user's content, and gets a reply constrained to a schema
// (claudeSchemas.js) via claudeClient.js.
import { requestStructured, requestText } from "./claudeClient.js";
import * as prompt from "./claudePrompts.js";
import {
  FOOD_ITEMS_SCHEMA,
  NUTRITION_SCHEMA,
  PORTION_SCHEMA,
  RECIPE_SCHEMA,
} from "./claudeSchemas.js";

const user = (content) => [
  { role: "user", content: typeof content === "string" ? content : JSON.stringify(content) },
];
const WEB_SEARCH = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

/** The food items (name + nutrition) in a description of what was eaten. */
export async function claudeParseFood(text) {
  const body = { max_tokens: 1000, system: prompt.PARSE_FOOD, messages: user(text) };
  const result = await requestStructured(body, FOOD_ITEMS_SCHEMA);
  return result.items;
}

/** A full recipe from a description (web search allowed); saved recipes may be ingredients. */
export async function claudeCreateRecipe(description, savedRecipeNames = []) {
  const system = prompt.createRecipe(savedRecipeNames);
  const body = { max_tokens: 2000, tools: WEB_SEARCH, system, messages: user(description) };
  return requestStructured(body, RECIPE_SCHEMA);
}

/** Nutrition per serving recalculated from the recipe's ingredients and servings. */
export async function claudeRecalculateNutrition(recipe) {
  const { servings, ingredients } = recipe;
  const body = { max_tokens: 600, system: prompt.RECALCULATE_NUTRITION };
  return requestStructured(
    { ...body, messages: user({ servings, ingredients }) },
    NUTRITION_SCHEMA,
  );
}

// Nutrition for an amount of a saved recipe in g / ml / oz. Used when the
// recipe has no Wt/portion (or for ml); with a Wt/portion, g and oz are
// scaled locally instead.
export async function claudeScaleRecipeNutrition(recipe, qty, unit) {
  const content = {
    name: recipe.name,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    nutrition_per_serving: recipe.nutrition,
    portion_g: recipe.portion_g ?? null,
    amount: qty,
    unit,
  };
  const body = { max_tokens: 600, system: prompt.SCALE_RECIPE, messages: user(content) };
  return requestStructured(body, NUTRITION_SCHEMA);
}

// Estimated Wt/portion: the total weight of all the ingredients as listed, divided by servings — convert volumes and counts to grams with typical weights (e.g. 1 medium onion, 1 tbsp oil) and do not adjust for water lost or absorbed in cooking.
export async function claudeEstimatePortionWeight(recipe) {
  const { name, servings, ingredients } = recipe;
  const body = { max_tokens: 600, system: prompt.ESTIMATE_PORTION };
  return requestStructured(
    { ...body, messages: user({ name, servings, ingredients }) },
    PORTION_SCHEMA,
  );
}

/** The hand-edited draft refined: steps matched to the ingredients, nutrition recalculated. */
export async function claudeRegenerateRecipe(recipe) {
  const content = {
    name: recipe.name,
    description: recipe.description,
    source: recipe.source,
    servings: recipe.servings,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
    portion_g: recipe.portion_g ?? null,
  };
  const body = { max_tokens: 2000, system: prompt.REGENERATE_RECIPE, messages: user(content) };
  return requestStructured(body, RECIPE_SCHEMA);
}

/** The chat reply as text; the user's saved recipes are in the assistant's context. */
export async function claudeChat(messages, userRecipes = []) {
  return requestText({ max_tokens: 1000, system: prompt.chat(userRecipes), messages });
}
