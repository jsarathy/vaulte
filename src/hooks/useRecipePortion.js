// src/hooks/useRecipePortion.js — state of the "How much?" box for adding a saved recipe.
import { useRef, useState } from "react";
import { claudeScaleRecipeNutrition } from "../api/claude";
import { parseQty, scaleMacros, calcErrorText } from "../lib/recipePortion.js";

const FRESH = { recipe: null, qtyText: "1", unit: "portion", claudeResult: null, error: "" };

async function calculateWithClaude({ recipe, qtyText, unit }, update) {
  update({ loading: true, error: "" });
  try {
    const nutrition = await claudeScaleRecipeNutrition(recipe, parseQty(qtyText), unit);
    update({ claudeResult: scaleMacros(nutrition, 1) });
  } catch (err) {
    update({ error: calcErrorText(err) });
  } finally {
    update({ loading: false });
  }
}

/**
 * box.recipe is the recipe being added (null = closed). isOpenRef is set as soon as
 * the box opens, for the food-name box's blur timer, which runs before a re-render.
 */
export function useRecipePortion() {
  const [box, setBox] = useState({ ...FRESH, loading: false });
  const isOpenRef = useRef(null);
  isOpenRef.current = box.recipe;
  const update = (fields) => setBox((b) => ({ ...b, ...fields }));
  const open = (recipe) => {
    isOpenRef.current = recipe;
    setBox((b) => ({ ...FRESH, loading: b.loading, recipe }));
  };
  return {
    ...box,
    isOpenRef,
    open,
    close: () => update({ recipe: null }),
    // A new amount or unit clears Claude's result and any error
    setQty: (qtyText) => update({ qtyText, claudeResult: null, error: "" }),
    setUnit: (unit) => update({ unit, claudeResult: null, error: "" }),
    calculate: () => calculateWithClaude(box, update),
  };
}
