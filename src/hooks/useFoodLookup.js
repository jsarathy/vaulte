// src/hooks/useFoodLookup.js — state and actions of the "Get Nutrition" box.
// ctx = { userId, userRecipes, setUserRecipes, setAddItem, addToDay(item), startRecipe(name) }
import { useRef, useState } from "react";
import { genId } from "../constants/helpers";
import { saveRecipe, deleteRecipe } from "../api/firestore";
import { propagateRecipeChange } from "../api/recipeWeights";
import { claudeLookupFood } from "../api/foodLookup";
import {
  parseQty,
  isDish,
  formItemFromLookup,
  recipeFromLookup,
  sameNameRecipes,
  withoutName,
  replaceByNameSorted,
} from "../lib/foodLookup.js";

const FRESH = { qtyText: "1", unit: "portion", error: "", save: false };
const LOOKUP_ERROR = "Could not fetch nutrition — fill in manually or try again.";

// Same name already saved → overwrite the first copy (same id), delete the others
async function saveLookedUp(ctx, reply, request) {
  const sameName = sameNameRecipes(ctx.userRecipes, request.name);
  const replaced = sameName[0] || null;
  const recipe = recipeFromLookup(reply, { ...request, id: replaced?.id ?? genId() });
  await saveRecipe(ctx.userId, recipe);
  for (const dup of sameName.slice(1)) await deleteRecipe(ctx.userId, dup.id);
  ctx.setUserRecipes((prev) => replaceByNameSorted(prev, recipe));
  propagateRecipeChange({
    uid: ctx.userId,
    oldA: replaced,
    newA: recipe,
    recipes: [...withoutName(ctx.userRecipes, request.name), recipe],
    setUserRecipes: ctx.setUserRecipes,
  }).catch((e) => console.error("dependent recipe update failed", e));
}

// A dish goes to the recipe builder; a food fills the form (and is added if Add Item asked)
async function applyReply(ctx, state, { reply, request }) {
  if (isDish(reply)) {
    ctx.close();
    return ctx.startRecipe(request.name);
  }
  if (state.save) await saveLookedUp(ctx, reply, request); // a failed save keeps the box open
  const item = formItemFromLookup(reply, request);
  ctx.setAddItem(item);
  ctx.close();
  if (state.box.autoSubmit) await ctx.addToDay(item);
}

async function getNutrition(ctx, state, update) {
  const request = { name: state.box.name, qty: parseQty(state.qtyText), unit: state.unit };
  update({ loading: true, error: "" });
  try {
    await applyReply(ctx, state, { reply: await claudeLookupFood(request), request });
  } catch {
    update({ error: LOOKUP_ERROR });
  } finally {
    update({ loading: false });
  }
}

function useLookupState() {
  const [state, setState] = useState({ ...FRESH, box: null, loading: false });
  const update = (fields) => setState((s) => ({ ...s, ...fields }));
  const isOpenRef = useRef(null);
  isOpenRef.current = state.box;
  return [state, update, isOpenRef];
}

/**
 * box: { name, autoSubmit } while open (null = closed). isOpenRef is the live value for the
 * food-name box's blur timer; inputRef is focused when the box opens.
 */
export function useFoodLookup(ctx) {
  const [state, update, isOpenRef] = useLookupState();
  const inputRef = useRef(null);
  const close = () => update({ box: null });
  return {
    ...state,
    isOpenRef,
    inputRef,
    open: (name, { autoSubmit } = {}) => {
      update({ ...FRESH, box: autoSubmit ? { name, autoSubmit } : { name } });
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    close,
    setQty: (qtyText) => update({ qtyText }),
    setUnit: (unit) => update({ unit }),
    setSave: (save) => update({ save }),
    getNutrition: () => getNutrition({ ...ctx, close }, state, update),
  };
}
