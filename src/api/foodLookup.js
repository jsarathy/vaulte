// src/api/foodLookup.js — Claude call for "Get Nutrition" (through the /api/claude proxy).
import { lookupPrompt, parseLookupReply } from "../lib/foodLookup.js";
import { claudeFetch } from "./claudeFetch.js";
import { usageField } from "./usageContext.js";

/** { name, qty, unit } → Claude's reply object ({ kind:"DISH" } or nutrition); throws on failure. */
export async function claudeLookupFood(request) {
  const res = await claudeFetch({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: lookupPrompt(request) }],
    ...usageField("lookup_food"),
  });
  return parseLookupReply(await res.json());
}
