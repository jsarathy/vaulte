// src/lib/photoLog.js — "Log from Photo": Claude lists the foods in a photo with nutrition.
import { MACROS } from "../constants/recipeLinks.js";

export const PHOTO_PROMPT = `Identify every food item visible in this photo and estimate realistic nutrition values.
Reply with ONLY a JSON array, no markdown, no explanation:
[{"name":"...","kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}]
Be specific with names (e.g. "Grilled chicken breast ~150g"). Round to 1 decimal place.`;

export const PHOTO_ERROR = "Could not analyse photo. Try a clearer image or add items manually.";

/** Claude's reply (API response body) → the list of foods; a ```json fence is allowed. */
export function parsePhotoReply(data) {
  let text = (data.content?.[0]?.text || "[]").trim();
  if (text.startsWith("```")) text = text.split("```")[1]?.replace(/^json/, "");
  return JSON.parse(text);
}

export const identifiedText = (n) =>
  `Claude identified ${n} item${n !== 1 ? "s" : ""}. Tap to load into the form above, or log all at once.`;

export const itemSummary = (item) =>
  `${item.kcal} kcal · P:${item.protein}g F:${item.fat}g C:${item.carbs}g`;

/** The Add Food form filled with one identified food. */
export const formItemFromPhoto = (item) => ({
  name: item.name,
  ...Object.fromEntries(MACROS.map((k) => [k, item[k]])),
});

/** A 1-serving recipe from the identified foods: totals to 1 dp, a name only for one food. */
export function photoRecipe(items, id) {
  const total = (k) => Math.round(items.reduce((t, i) => t + (Number(i[k]) || 0), 0) * 10) / 10;
  return {
    id,
    name: items.length === 1 ? items[0].name : "",
    description: "Saved from photo",
    servings: 1,
    nutrition: Object.fromEntries(MACROS.map((k) => [k, total(k)])),
    ingredients: items.map((i) => ({ amount: "", item: i.name })),
    steps: [],
    notes: "",
  };
}
