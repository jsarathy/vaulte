// src/lib/recipeVolume.js — whether a saved recipe is a liquid or a solid, and its volume per portion
// (Fix 91), and the limit on how often the backfill tries to fill in what a recipe is missing.
//
// form         "liquid" | "solid" — from Claude when the recipe is built or estimated
// portion_ml   millilitres in one portion, for a liquid (blank when not known)
// fill_attempts { key, n } — how many times the backfill has tried while the recipe's servings
//              and ingredients were as `key`; editing them starts the count again

export const FORMS = ["liquid", "solid"];
export const MAX_FILL_ATTEMPTS = 2;

/** Claude's form and portion_ml as the fields to keep: nothing if the form is not usable. */
export function volumeFields(result) {
  if (!FORMS.includes(result?.form)) return {};
  const ml = Math.round(Number(result.portion_ml));
  return result.form === "liquid" && ml > 0
    ? { form: "liquid", portion_ml: ml }
    : { form: result.form };
}

/** Millilitres in one portion of a liquid: its stored volume, else its weight (1 g ≈ 1 ml); null if unknown or not a liquid. */
export function portionVolume(recipe) {
  if (recipe?.form !== "liquid") return null;
  const ml = Number(recipe.portion_ml) > 0 ? Number(recipe.portion_ml) : Number(recipe.portion_g);
  return ml > 0 ? ml : null;
}

/** What the recipe was made from: servings and ingredients. */
export const contentKey = (r) => JSON.stringify([Number(r?.servings) || 0, r?.ingredients || []]);

/** True while the recipe lacks a Wt/portion or a form. */
export const needsFill = (r) => !(Number(r?.portion_g) > 0) || !FORMS.includes(r?.form);

/** True unless the backfill has already tried the maximum number of times for this content. */
export const attemptsLeft = (r) =>
  r?.fill_attempts?.key !== contentKey(r) || (r.fill_attempts.n || 0) < MAX_FILL_ATTEMPTS;

/** The recipe with one more attempt counted for its current content. */
export function withAttempt(r) {
  const key = contentKey(r);
  const n = r.fill_attempts?.key === key ? (r.fill_attempts.n || 0) + 1 : 1;
  return { ...r, fill_attempts: { key, n } };
}
