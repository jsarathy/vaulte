// tests/claude.test.mjs — src/api/claude.js: what each helper sends to /api/claude (model, limits,
// system prompt, messages, tools, the Structured Outputs schema) and how replies and failures
// come back. fetch is stubbed; no network.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  claudeChat,
  claudeCreateRecipe,
  claudeEstimatePortionWeight,
  claudeParseFood,
  claudeRecalculateNutrition,
  claudeRegenerateRecipe,
  claudeScaleRecipeNutrition,
} from "../src/api/claude.js";

let calls, reply;
const text = (t) => ({ content: [{ type: "text", text: t }] });
const json = (obj) => text(JSON.stringify(obj));
beforeEach(() => {
  calls = [];
  reply = { status: 200, body: json({}) };
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method, headers: opts.headers, body: JSON.parse(opts.body) });
    const r = typeof reply === "function" ? reply() : reply;
    const bodyText = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return { ok: r.status < 400, status: r.status, text: async () => bodyText };
  };
});
const sent = () => calls[0].body;
const schemaOf = () => sent().output_config.format;

const NUTRITION_KEYS = [
  "kcal",
  "fat",
  "sat_fat",
  "carbs",
  "sugar",
  "fibre",
  "net_carbs",
  "protein",
];
const RECIPE = {
  name: "Soup",
  description: "d",
  source: "Home recipe",
  servings: 4,
  prep_time: "5 min",
  cook_time: "20 min",
  ingredients: [{ amount: "1", item: "onion" }],
  steps: ["cook"],
  notes: "n",
  nutrition: { kcal: 100 },
  portion_g: 250,
  id: "r1", // never sent
  portion_g_source: "weighed", // never sent
};

test("every call is a POST of JSON to /api/claude with claude-sonnet-4-6", async () => {
  reply.body = json({ items: [] });
  await claudeParseFood("an apple");
  assert.deepEqual(
    [calls[0].url, calls[0].method, calls[0].headers],
    ["/api/claude", "POST", { "Content-Type": "application/json" }],
  );
  assert.equal(sent().model, "claude-sonnet-4-6");
  assert.equal(calls.length, 1);
});

test("claudeParseFood: the food text, a 1000-token limit, an items schema; returns the items", async () => {
  const items = [{ name: "Apple (100g)", kcal: 52 }];
  reply.body = json({ items });
  assert.deepEqual(await claudeParseFood("an apple"), items);
  assert.equal(sent().max_tokens, 1000);
  assert.match(sent().system, /precise nutrition analysis assistant/);
  assert.match(sent().system, /"Walnuts \(30g\)"/);
  assert.deepEqual(sent().messages, [{ role: "user", content: "an apple" }]);
  assert.equal(sent().tools, undefined);
  const { type, schema } = schemaOf();
  assert.equal(type, "json_schema");
  assert.deepEqual(schema.required, ["items"]);
  const item = schema.properties.items.items;
  assert.deepEqual(item.required, ["name", ...NUTRITION_KEYS]);
  assert.deepEqual(Object.keys(item.properties), ["name", ...NUTRITION_KEYS]);
  assert.equal(item.additionalProperties, false);
  assert.equal(schema.additionalProperties, false);
});

test("claudeCreateRecipe: web search, the recipe schema, saved recipe names when given", async () => {
  reply.body = json(RECIPE);
  assert.deepEqual(await claudeCreateRecipe("a soup"), RECIPE);
  assert.equal(sent().max_tokens, 2000);
  assert.deepEqual(sent().tools, [
    { type: "web_search_20250305", name: "web_search", max_uses: 3 },
  ]);
  assert.match(sent().system, /use web search to find a real, reputable recipe/);
  assert.match(sent().system, /portion_g is the estimated weight of one serving/);
  assert.doesNotMatch(sent().system, /saved recipes/);
  assert.deepEqual(sent().messages, [{ role: "user", content: "a soup" }]);
  const { schema } = schemaOf();
  assert.deepEqual(schema.required, [
    "name",
    "description",
    "source",
    "servings",
    "prep_time",
    "cook_time",
    "ingredients",
    "steps",
    "notes",
    "portion_g",
    "nutrition",
  ]);
  assert.deepEqual(schema.properties.nutrition.required, NUTRITION_KEYS);
  assert.deepEqual(schema.properties.ingredients.items.required, ["amount", "item"]);
  assert.equal(schema.properties.ingredients.items.additionalProperties, false);
  calls = [];
  await claudeCreateRecipe("soup with my stock", ["Stock", "Bread"]);
  assert.match(sent().system, /saved recipes: \["Stock","Bread"\]/);
  assert.match(sent().system, /list it as ONE ingredient whose "item" is exactly that saved name/);
});

test("claudeRecalculateNutrition: servings + ingredients only, the nutrition schema", async () => {
  const nutrition = { kcal: 1 };
  reply.body = json(nutrition);
  assert.deepEqual(await claudeRecalculateNutrition(RECIPE), nutrition);
  assert.equal(sent().max_tokens, 600);
  assert.match(sent().system, /Recalculate the nutrition PER SERVING from scratch/);
  assert.deepEqual(JSON.parse(sent().messages[0].content), {
    servings: 4,
    ingredients: [{ amount: "1", item: "onion" }],
  });
  assert.equal(sent().messages[0].role, "user");
  const { schema } = schemaOf();
  assert.deepEqual(schema.required, NUTRITION_KEYS);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.kcal, { type: "number" });
});

test("claudeScaleRecipeNutrition: the cooked recipe, its per-serving nutrition, the amount", async () => {
  reply.body = json({ kcal: 2 });
  assert.deepEqual(await claudeScaleRecipeNutrition(RECIPE, 150, "g"), { kcal: 2 });
  assert.equal(sent().max_tokens, 600);
  assert.match(sent().system, /Return the nutrition for the requested amount of the cooked dish/);
  assert.deepEqual(JSON.parse(sent().messages[0].content), {
    name: "Soup",
    servings: 4,
    ingredients: [{ amount: "1", item: "onion" }],
    nutrition_per_serving: { kcal: 100 },
    portion_g: 250,
    amount: 150,
    unit: "g",
  });
  assert.deepEqual(schemaOf().schema.required, NUTRITION_KEYS);
  calls = [];
  await claudeScaleRecipeNutrition({ ...RECIPE, portion_g: undefined }, 1, "ml");
  assert.equal(JSON.parse(sent().messages[0].content).portion_g, null); // null, never undefined
});

test("claudeEstimatePortionWeight: name, servings, ingredients; the portion schema", async () => {
  reply.body = json({ total_g: 1000, portion_g: 250 });
  assert.deepEqual(await claudeEstimatePortionWeight(RECIPE), { total_g: 1000, portion_g: 250 });
  assert.equal(sent().max_tokens, 600);
  assert.match(sent().system, /portion_g = total_g ÷ servings/);
  assert.deepEqual(JSON.parse(sent().messages[0].content), {
    name: "Soup",
    servings: 4,
    ingredients: [{ amount: "1", item: "onion" }],
  });
  const { schema } = schemaOf();
  assert.deepEqual(schema.required, ["total_g", "portion_g"]);
  assert.equal(schema.additionalProperties, false);
});

test("claudeRegenerateRecipe: the draft's own fields (portion_g null if missing), recipe schema", async () => {
  reply.body = json(RECIPE);
  assert.deepEqual(await claudeRegenerateRecipe(RECIPE), RECIPE);
  assert.equal(sent().max_tokens, 2000);
  assert.equal(sent().tools, undefined);
  assert.match(
    sent().system,
    /treat their name, servings, ingredients, steps, and notes as the source of truth/,
  );
  assert.deepEqual(JSON.parse(sent().messages[0].content), {
    name: "Soup",
    description: "d",
    source: "Home recipe",
    servings: 4,
    prep_time: "5 min",
    cook_time: "20 min",
    ingredients: [{ amount: "1", item: "onion" }],
    steps: ["cook"],
    notes: "n",
    portion_g: 250,
  });
  assert.deepEqual(schemaOf().schema.required.at(-1), "nutrition");
  calls = [];
  await claudeRegenerateRecipe({ ...RECIPE, portion_g: undefined });
  assert.equal(JSON.parse(sent().messages[0].content).portion_g, null);
});

test("claudeChat: plain text back, no schema; saved recipes go into the system prompt", async () => {
  reply.body = text("Hello!");
  const messages = [{ role: "user", content: "hi" }];
  assert.equal(await claudeChat(messages), "Hello!");
  assert.equal(sent().max_tokens, 1000);
  assert.equal(sent().output_config, undefined);
  assert.equal(
    sent().system,
    "You are a helpful nutrition and health assistant. Answer naturally and conversationally.",
  );
  assert.deepEqual(sent().messages, messages);
  calls = [];
  await claudeChat(messages, [RECIPE]);
  assert.match(sent().system, /saved recipes available/);
  const listed = JSON.parse(sent().system.split("them:\n")[1]);
  assert.deepEqual(listed, [
    {
      name: "Soup",
      description: "d",
      servings: 4,
      ingredients: [{ amount: "1", item: "onion" }],
      steps: ["cook"],
      nutrition: { kcal: 100 },
    },
  ]);
});

test("the reply's last text block is used (tool blocks are skipped); none → an error", async () => {
  reply.body = {
    content: [
      { type: "server_tool_use", name: "web_search" },
      { type: "text", text: '{"kcal": 1}' },
      { type: "web_search_tool_result" },
      { type: "text", text: '{"kcal": 2}' },
    ],
  };
  assert.deepEqual(await claudeRecalculateNutrition(RECIPE), { kcal: 2 });
  reply.body = { content: [{ type: "server_tool_use" }] };
  await assert.rejects(claudeRecalculateNutrition(RECIPE), {
    message: "Claude returned no text content.",
  });
  reply.body = { content: [{ type: "text", text: "   " }] };
  await assert.rejects(claudeRecalculateNutrition(RECIPE), {
    message: "Claude returned no text content.",
  });
  reply.body = {};
  await assert.rejects(claudeRecalculateNutrition(RECIPE), {
    message: "Claude returned no text content.",
  });
  reply.body = { content: [{ type: "server_tool_use" }] };
  assert.equal(await claudeChat([]), ""); // chat just gives nothing back
});

test("API errors, refusals, cut-off and unparseable replies say what happened", async () => {
  reply = {
    status: 400,
    body: { error: { type: "invalid_request_error", message: "Bad request." } },
  };
  await assert.rejects(claudeParseFood("x"), { message: "Bad request." });
  await assert.rejects(claudeChat([]), { message: "Bad request." });
  reply = { status: 200, body: { error: { type: "overloaded_error" } } }; // an error in a 200
  await assert.rejects(claudeParseFood("x"), { message: "overloaded_error" });
  reply = { status: 500, body: { content: [] } };
  await assert.rejects(claudeParseFood("x"), { message: "API request failed (500)" });
  reply = {
    status: 200,
    body: { stop_reason: "refusal", content: [{ type: "text", text: "{}" }] },
  };
  await assert.rejects(claudeParseFood("x"), {
    message: "Claude declined to generate this — try rephrasing your request.",
  });
  reply = {
    status: 200,
    body: { stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] },
  };
  await assert.rejects(claudeParseFood("x"), {
    message: "Response was cut off before completing — try a shorter/simpler request.",
  });
  reply = { status: 200, body: text("not json " + "x".repeat(300)) };
  await assert.rejects(claudeParseFood("x"), {
    message: `Response wasn't valid JSON: ${("not json " + "x".repeat(300)).slice(0, 200)}`,
  });
});

test("a non-JSON body (the platform failing before the function ran) is explained", async () => {
  reply = { status: 504, body: "<html>Gateway Timeout</html>" };
  await assert.rejects(claudeChat([]), {
    message: /^The request timed out — this can happen with web search/,
  });
  reply = { status: 504, body: "<html>upstream error</html>" }; // a 504 even without the word
  await assert.rejects(claudeChat([]), { message: /^The request timed out/ });
  reply = { status: 500, body: "FUNCTION_INVOCATION_TIMED OUT" };
  await assert.rejects(claudeChat([]), { message: /^The request timed out/ });
  reply = { status: 502, body: "<html>" + "x".repeat(200) };
  await assert.rejects(claudeParseFood("x"), {
    message: `Server returned a non-JSON response (status 502): ${("<html>" + "x".repeat(200)).slice(0, 150)}`,
  });
  reply = { status: 200, body: "" };
  await assert.rejects(claudeChat([]), {
    message: "Server returned a non-JSON response (status 200): empty body",
  });
});
