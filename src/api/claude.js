// src/api/claude.js — All Claude API helpers

import { auth } from "../firebase";

// Retrieve the current user's Firebase ID token for server-side verification.
// Returns an empty object if there is no signed-in user (should not happen in practice).
async function authHeader() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

export async function claudeParseFood(text) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json", ...await authHeader()},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
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
  const data = await res.json();
  let raw = data.content?.[0]?.text?.trim() || "";
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  return JSON.parse(raw);
}

export async function claudeCreateRecipe(description) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json", ...await authHeader()},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      system:`You are a recipe and nutrition expert. The user will describe a recipe.
Return ONLY a JSON object — no markdown, no explanation. The object must have exactly these fields:
{
  "name": string,
  "description": string (one sentence),
  "source": string (e.g. "Home recipe"),
  "servings": number,
  "prep_time": string (e.g. "10 minutes"),
  "cook_time": string (e.g. "25 minutes"),
  "ingredients": [ { "amount": string, "item": string } ],
  "steps": [ string ],
  "notes": string,
  "nutrition": { "kcal": number, "fat": number, "sat_fat": number, "carbs": number, "sugar": number, "fibre": number, "net_carbs": number, "protein": number }
}
nutrition is PER SERVING. Use accurate nutritional database values. Return ONLY valid JSON.`,
      messages:[{role:"user", content:description}]
    })
  });
  const data = await res.json();
  let raw = data.content?.[0]?.text?.trim() || "";
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  return JSON.parse(raw);
}

export async function claudeChat(messages) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json", ...await authHeader()},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      system:"You are a helpful nutrition and health assistant. Answer naturally and conversationally.",
      messages
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}
