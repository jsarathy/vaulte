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

export async function claudeParseFood(text) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:1000,
      system:`You are a precise nutrition analysis assistant. The user will describe food they ate.
Return ONLY a JSON array of food items — no other text, no markdown, no explanation whatsoever.
Each item must have exactly these fields:
- name (string): descriptive name including quantity/weight e.g. "Walnuts (30g)"
- kcal (number): calories
- fat (number): total fat in grams
- sat_fat (number): saturated fat in grams
- carbs (number): total carbohydrates in grams
- sugar (number): sugars in grams
- fibre (number): dietary fibre in grams
- net_carbs (number): carbs minus fibre
- protein (number): protein in grams
Use accurate nutritional database values. Round to 1 decimal place. Return ONLY valid JSON array.`,
      messages:[{role:"user", content:text}]
    })
  });
  const data = await safeJson(res);
  assertOk(res, data);
  let raw = extractFinalText(data).trim();
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  return JSON.parse(raw);
}

export async function claudeCreateRecipe(description) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:2000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      system:`You are a recipe and nutrition expert. The user will describe a recipe or dish they want.
If their description is vague or missing ingredient quantities, use web search to find a real, reputable recipe (e.g. a well-known recipe site) that matches what they asked for, and base your answer on it — don't ask the user for more detail, look it up instead.
Once you have enough detail, respond with ONLY a JSON object as your final message — no markdown, no explanation, no text before or after the JSON. The object must have exactly these fields:
{
  "name": string,
  "description": string (one sentence),
  "source": string (e.g. "Home recipe", or the site/publication name if looked up online),
  "servings": number,
  "prep_time": string (e.g. "10 minutes"),
  "cook_time": string (e.g. "25 minutes"),
  "ingredients": [ { "amount": string, "item": string } ],
  "steps": [ string ],
  "notes": string,
  "nutrition": { "kcal": number, "fat": number, "sat_fat": number, "carbs": number, "sugar": number, "fibre": number, "net_carbs": number, "protein": number }
}
nutrition is PER SERVING. Use accurate nutritional database values. Your final message must contain ONLY the JSON object and nothing else.`,
      messages:[{role:"user", content:description}]
    })
  });
  const data = await safeJson(res);
  assertOk(res, data);
  let raw = extractFinalText(data).trim();
  if (!raw) throw new Error("Claude returned no text content — check the browser console/network tab for the raw response.");
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Response wasn't valid JSON: ${raw.slice(0, 200)}`);
  }
}

export async function claudeRecalculateNutrition(recipe) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:500,
      system:`You are a precise nutrition analysis assistant. The user will give you a recipe's ingredients and serving count, possibly hand-edited. Recalculate the nutrition PER SERVING from scratch based on exactly what's given — don't reuse any nutrition values you might infer were there before.
Return ONLY a JSON object with exactly these fields, no markdown, no explanation:
{ "kcal": number, "fat": number, "sat_fat": number, "carbs": number, "sugar": number, "fibre": number, "net_carbs": number, "protein": number }
Use accurate nutritional database values. Return ONLY valid JSON.`,
      messages:[{role:"user", content: JSON.stringify({
        servings: recipe.servings,
        ingredients: recipe.ingredients
      })}]
    })
  });
  const data = await safeJson(res);
  assertOk(res, data);
  let raw = extractFinalText(data).trim();
  if (!raw) throw new Error("Claude returned no text content.");
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Response wasn't valid JSON: ${raw.slice(0, 200)}`);
  }
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
