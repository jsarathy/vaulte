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
import { claudeLookupFood } from "../src/api/foodLookup.js";
import { photoRequest } from "../src/lib/photoLog.js";
import { setUsageUser } from "../src/api/usageContext.js";

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

test("claudeChat: plain text back, no schema; with no saved recipes there is no tool", async () => {
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
  assert.equal(sent().tools, undefined);
  assert.equal(sent().tool_choice, undefined);
  assert.equal(calls.length, 1);
});

const toolUse = (id, query) => ({
  stop_reason: "tool_use",
  content: [
    { type: "text", text: "Let me look." },
    { type: "tool_use", id, name: "find_recipes", input: { query } },
  ],
});

test("claudeChat: with saved recipes none are sent; Claude gets a find_recipes tool", async () => {
  reply.body = text("Hello!");
  const messages = [{ role: "user", content: "hi" }];
  assert.equal(await claudeChat(messages, [RECIPE]), "Hello!");
  assert.match(sent().system, /call find_recipes/);
  assert.doesNotMatch(JSON.stringify(sent()), /onion|Soup|cook/); // no recipe content up front
  assert.equal(sent().tools.length, 1);
  assert.equal(sent().tools[0].name, "find_recipes");
  assert.equal(sent().tool_choice, undefined);
  assert.equal(calls.length, 1); // an ordinary question: one call
});

test("claudeChat: a tool request is answered from the recipes and sent back for the final reply", async () => {
  const replies = [toolUse("t1", "soup"), text("Soup has 100 kcal.")];
  reply = () => ({ status: 200, body: replies.shift() });
  const messages = [{ role: "user", content: "kcal in my soup?" }];
  assert.equal(await claudeChat(messages, [RECIPE]), "Soup has 100 kcal.");
  assert.equal(calls.length, 2);
  const second = calls[1].body.messages;
  assert.deepEqual(second.slice(0, 1), messages);
  assert.deepEqual(second[1], { role: "assistant", content: toolUse("t1", "soup").content });
  assert.equal(second[2].role, "user");
  assert.equal(second[2].content[0].type, "tool_result");
  assert.equal(second[2].content[0].tool_use_id, "t1");
  const found = JSON.parse(second[2].content[0].content);
  assert.equal(found.matches[0].name, "Soup");
  assert.deepEqual(found.matches[0].nutrition, { kcal: 100 });
  assert.equal(calls[1].body.tools.length, 1); // the tool stays defined
  assert.equal(calls[1].body.tool_choice, undefined);
  assert.deepEqual(
    calls.map((c) => c.body._usage.feature),
    ["chat", "chat"], // each round is recorded as a chat call
  );
});

test("claudeChat: several tool requests in one reply are all answered", async () => {
  const two = {
    stop_reason: "tool_use",
    content: [
      { type: "tool_use", id: "a", name: "find_recipes", input: { query: "soup" } },
      { type: "tool_use", id: "b", name: "find_recipes", input: { query: "nothing here" } },
    ],
  };
  const replies = [two, text("done")];
  reply = () => ({ status: 200, body: replies.shift() });
  await claudeChat([{ role: "user", content: "x" }], [RECIPE]);
  const answers = calls[1].body.messages[2].content;
  assert.deepEqual(
    answers.map((r) => r.tool_use_id),
    ["a", "b"],
  );
  assert.deepEqual(JSON.parse(answers[1].content), { matches: [], saved_recipe_names: ["Soup"] });
});

test("claudeChat: after 3 lookups the tool is switched off so Claude has to answer", async () => {
  let n = 0;
  reply = () => ({ status: 200, body: n++ < 3 ? toolUse("t" + n, "soup") : text("Final.") });
  assert.equal(await claudeChat([{ role: "user", content: "x" }], [RECIPE]), "Final.");
  assert.equal(calls.length, 4);
  assert.deepEqual(
    calls.map((c) => c.body.tool_choice),
    [undefined, undefined, undefined, { type: "none" }],
  );
  assert.equal(calls[3].body.tools.length, 1); // still defined: the history holds tool blocks
});

test("claudeChat: if Claude still asks on the last round, its text so far is the answer", async () => {
  reply = () => ({ status: 200, body: toolUse("t", "soup") });
  assert.equal(await claudeChat([{ role: "user", content: "x" }], [RECIPE]), "Let me look.");
  assert.equal(calls.length, 4);
});

test("claudeChat: a tool request without a query still gets an answer", async () => {
  const replies = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "z", name: "find_recipes" }] },
    text("ok"),
  ];
  reply = () => ({ status: 200, body: replies.shift() });
  await claudeChat([{ role: "user", content: "x" }], [RECIPE]);
  const answer = JSON.parse(calls[1].body.messages[2].content[0].content);
  assert.deepEqual(answer, { matches: [], saved_recipe_names: ["Soup"] });
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

// Fix 41: every call names its feature and carries the signed-in user, so the server can keep a
// record of what each feature costs.
test("every Claude call carries its feature name and the user", async () => {
  setUsageUser("user-7");
  const recipe = { name: "Soup", servings: 2, ingredients: [{ amount: "1", item: "onion" }] };
  const features = [];
  const run = async (feature, fn) => {
    calls = [];
    reply = { status: 200, body: json({ items: [], reply: "x" }) };
    await fn().catch(() => {}); // the reply need not be valid for the request to be checked
    features.push([feature, calls[0].body._usage]);
  };
  await run("parse_food", () => claudeParseFood("an apple"));
  await run("create_recipe", () => claudeCreateRecipe("a soup"));
  await run("recalc_nutrition", () => claudeRecalculateNutrition(recipe));
  await run("scale_recipe", () => claudeScaleRecipeNutrition(recipe, 100, "ml"));
  await run("estimate_portion", () => claudeEstimatePortionWeight(recipe));
  await run("regenerate_recipe", () => claudeRegenerateRecipe(recipe));
  await run("chat", () => claudeChat([{ role: "user", content: "hi" }]));
  await run("lookup_food", () => claudeLookupFood({ name: "apple", qty: 1, unit: "portion" }));
  features.push(["photo", photoRequest("abc")._usage]);
  assert.deepEqual(
    features,
    features.map(([feature]) => [feature, { feature, userId: "user-7" }]),
  );
  assert.equal(features.length, 9);
  setUsageUser(null);
});
