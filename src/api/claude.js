// src/api/claude.js — All Claude API helpers

// Grabs the model's final text block — needed because when web_search is used,
// content[0] may be a tool-use/tool-result block rather than text.
function extractFinalText(data) {
  const textBlocks = (data.content || []).filter(b => b.type === "text");
  return textBlocks.length ? textBlocks[textBlocks.length - 1].text : "";
}

// res.json() throws a cryptic "Unexpected token" error if the body isn't JSON —
// which happens when the platform itself fails (timeout, crash) before our
// serverless function code runs, returning an HTML/plain-text error page instead
// of a JSON body. This reads the body as text first so we can say what actually happened.
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 504 || /timed?\s?out/i.test(text)
        ? "The request timed out — this can happen with web search on a longer lookup. Try a more specific description, or increase maxDuration in vercel.json."
        : `Server returned a non-JSON response (status ${res.status}): ${text.slice(0, 150) || "empty body"}`
    );
  }
}

// Throws with the real API error message instead of silently returning empty content.
function assertOk(res, data) {
  if (!res.ok || data.error) {
    const msg = data.error?.message || data.error?.type || `API request failed (${res.status})`;
    throw new Error(msg);
  }
}

// Sends a request with output_config.format set, so the API guarantees the
// response text matches the given JSON schema via constrained decoding
// (Structured Outputs) — no reliance on Claude following "return only JSON"
// instructions, no prefill needed, and it still works fine alongside tools
// like web_search since the grammar only constrains Claude's final text output.
async function requestStructured(body, schema) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      ...body,
      output_config: { format: { type: "json_schema", schema } }
    })
  });
  const data = await safeJson(res);
  assertOk(res, data);
  if (data.stop_reason === "refusal") {
    throw new Error("Claude declined to generate this — try rephrasing your request.");
  }
  if (data.stop_reason === "max_tokens") {
    throw new Error("Response was cut off before completing — try a shorter/simpler request.");
  }
  const raw = extractFinalText(data).trim();
  if (!raw) throw new Error("Claude returned no text content.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Response wasn't valid JSON: ${raw.slice(0, 200)}`);
  }
}

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    kcal: { type:"number" }, fat: { type:"number" }, sat_fat: { type:"number" },
    carbs: { type:"number" }, sugar: { type:"number" }, fibre: { type:"number" },
    net_carbs: { type:"number" }, protein: { type:"number" }
  },
  required: ["kcal","fat","sat_fat","carbs","sugar","fibre","net_carbs","protein"],
  additionalProperties: false
};

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    name: { type:"string" },
    description: { type:"string" },
    source: { type:"string" },
    servings: { type:"number" },
    prep_time: { type:"string" },
    cook_time: { type:"string" },
    ingredients: {
      type:"array",
      items: {
        type:"object",
        properties: { amount:{type:"string"}, item:{type:"string"} },
        required: ["amount","item"],
        additionalProperties: false
      }
    },
    steps: { type:"array", items: { type:"string" } },
    notes: { type:"string" },
    nutrition: NUTRITION_SCHEMA
  },
  required: ["name","description","source","servings","prep_time","cook_time","ingredients","steps","notes","nutrition"],
  additionalProperties: false
};

export async function claudeParseFood(text) {
  const result = await requestStructured({
    model:"claude-sonnet-4-6",
    max_tokens:1000,
    system:`You are a precise nutrition analysis assistant. The user will describe food they ate. For each distinct food item, estimate nutrition using accurate nutritional database values, rounded to 1 decimal place. Name should be descriptive and include quantity/weight, e.g. "Walnuts (30g)".`,
    messages:[{role:"user", content:text}]
  }, {
    type:"object",
    properties: {
      items: {
        type:"array",
        items: {
          type:"object",
          properties: { name:{type:"string"}, ...NUTRITION_SCHEMA.properties },
          required: ["name", ...NUTRITION_SCHEMA.required],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  });
  return result.items;
}

export async function claudeCreateRecipe(description) {
  return requestStructured({
    model:"claude-sonnet-4-6",
    max_tokens:2000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    system:`You are a recipe and nutrition expert. The user will describe a recipe or dish they want.
If their description is vague or missing ingredient quantities, use web search to find a real, reputable recipe (e.g. a well-known recipe site) that matches what they asked for, and base your answer on it — don't ask the user for more detail, look it up instead.
"source" should be "Home recipe" or the site/publication name if looked up online. nutrition is PER SERVING, using accurate nutritional database values.`,
    messages:[{role:"user", content:description}]
  }, RECIPE_SCHEMA);
}

export async function claudeRecalculateNutrition(recipe) {
  return requestStructured({
    model:"claude-sonnet-4-6",
    max_tokens:600,
    system:`You are a precise nutrition analysis assistant. The user will give you a recipe's ingredients and serving count, possibly hand-edited. Recalculate the nutrition PER SERVING from scratch based on exactly what's given — don't reuse any nutrition values you might infer were there before. Use accurate nutritional database values.`,
    messages:[{role:"user", content: JSON.stringify({
      servings: recipe.servings,
      ingredients: recipe.ingredients
    })}]
  }, NUTRITION_SCHEMA);
}

export async function claudeRegenerateRecipe(recipe) {
  return requestStructured({
    model:"claude-sonnet-4-6",
    max_tokens:2000,
    system:`You are a recipe and nutrition expert. The user has a recipe draft they've hand-edited — treat their name, servings, ingredients, steps, and notes as the source of truth, not something to second-guess.
Refine it: rewrite the method steps if needed so they match the current ingredient list (e.g. if an ingredient was added, removed, or its amount changed, update the steps accordingly), and recalculate the nutrition per serving from scratch based on the current ingredients and servings — don't reuse any nutrition values that might already be present.`,
    messages:[{role:"user", content: JSON.stringify({
      name: recipe.name,
      description: recipe.description,
      source: recipe.source,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      notes: recipe.notes
    })}]
  }, RECIPE_SCHEMA);
}

export async function claudeChat(messages, userRecipes = []) {
  const recipesContext = userRecipes.length > 0
    ? `\n\nThe user has the following saved recipes available. Use this list to answer any questions about their recipes (ingredients, nutrition, steps, etc.) instead of saying you don't have access to them:\n${JSON.stringify(
        userRecipes.map(r => ({
          name: r.name,
          description: r.description,
          servings: r.servings,
          ingredients: r.ingredients,
          steps: r.steps,
          nutrition: r.nutrition
        }))
      )}`
    : "";

  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:1000,
      system:`You are a helpful nutrition and health assistant. Answer naturally and conversationally.${recipesContext}`,
      messages
    })
  });
  const data = await safeJson(res);
  assertOk(res, data);
  return extractFinalText(data);
}
