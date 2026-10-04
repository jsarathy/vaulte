// src/api/foodLookup.js — Claude call for "Get Nutrition" (through the /api/claude proxy).
import { lookupPrompt, parseLookupReply } from "../lib/foodLookup.js";

/** { name, qty, unit } → Claude's reply object ({ kind:"DISH" } or nutrition); throws on failure. */
export async function claudeLookupFood(request) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: lookupPrompt(request) }],
    }),
  });
  return parseLookupReply(await res.json());
}
