// src/api/claude.js — the Claude calls the app makes: parsing food, creating / recalculating /
// scaling / regenerating recipes, estimating a portion weight, and the chat. Each sends a system
// prompt (claudePrompts.js) and the user's content, and gets a reply constrained to a schema
// (claudeSchemas.js) via claudeClient.js.
import { finalText, requestMessage, requestStructured } from "./claudeClient.js";
import { FIND_RECIPES_TOOL, findRecipes } from "../lib/chatRecipes.js";
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
  const result = await requestStructured(body, FOOD_ITEMS_SCHEMA, "parse_food");
  return result.items;
}

/** A full recipe from a description (web search allowed); saved recipes may be ingredients. */
export async function claudeCreateRecipe(description, savedRecipeNames = []) {
  const system = prompt.createRecipe(savedRecipeNames);
  const body = { max_tokens: 2000, tools: WEB_SEARCH, system, messages: user(description) };
  return requestStructured(body, RECIPE_SCHEMA, "create_recipe");
}

/** Nutrition per serving recalculated from the recipe's ingredients and servings. */
export async function claudeRecalculateNutrition(recipe) {
  const { servings, ingredients } = recipe;
  const body = { max_tokens: 600, system: prompt.RECALCULATE_NUTRITION };
  return requestStructured(
    { ...body, messages: user({ servings, ingredients }) },
    NUTRITION_SCHEMA,
    "recalc_nutrition",
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
  return requestStructured(body, NUTRITION_SCHEMA, "scale_recipe");
}

// Estimated Wt/portion: the total weight of all the ingredients as listed, divided by servings — convert volumes and counts to grams with typical weights (e.g. 1 medium onion, 1 tbsp oil) and do not adjust for water lost or absorbed in cooking.
export async function claudeEstimatePortionWeight(recipe) {
  const { name, servings, ingredients } = recipe;
  const body = { max_tokens: 600, system: prompt.ESTIMATE_PORTION };
  return requestStructured(
    { ...body, messages: user({ name, servings, ingredients }) },
    PORTION_SCHEMA,
    "estimate_portion",
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
  return requestStructured(body, RECIPE_SCHEMA, "regenerate_recipe");
}

const MAX_LOOKUPS = 3;

/** The tool requests in a reply, answered from the saved recipes, as the next user message. */
const toolAnswers = (content, recipes) => ({
  role: "user",
  content: content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      type: "tool_result",
      tool_use_id: b.id,
      content: JSON.stringify(findRecipes(recipes, b.input?.query)),
    })),
});

/** One chat request; with recipes it carries the lookup tool, which is switched off in the last round. */
function chatRequest(messages, hasRecipes, round) {
  const body = { max_tokens: 1000, system: prompt.chat(hasRecipes), messages };
  if (!hasRecipes) return body;
  const tool_choice = round >= MAX_LOOKUPS ? { type: "none" } : undefined;
  return { ...body, tools: [FIND_RECIPES_TOOL], ...(tool_choice && { tool_choice }) };
}

/**
 * The chat reply as text. The saved recipes are not sent: with any, Claude may ask for them with
 * find_recipes (up to 3 rounds, then it must answer), and each round is another call.
 */
export async function claudeChat(messages, userRecipes = []) {
  const hasRecipes = userRecipes.length > 0;
  let convo = messages;
  for (let round = 0; ; round++) {
    const data = await requestMessage(chatRequest(convo, hasRecipes, round), "chat");
    if (data.stop_reason !== "tool_use" || round >= MAX_LOOKUPS) return finalText(data);
    const asked = { role: "assistant", content: data.content };
    convo = [...convo, asked, toolAnswers(data.content, userRecipes)];
  }
}
