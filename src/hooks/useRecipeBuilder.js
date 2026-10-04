// src/hooks/useRecipeBuilder.js — state and actions of the recipe builder.
// ctx = { userId, userRecipes, setUserRecipes, setAddItem, setRecipeNotice, setShowRecipesModal }
import { useState } from "react";
import { genId } from "../constants/helpers";
import { saveRecipe } from "../api/firestore";
import { claudeCreateRecipe } from "../api/claude";
import { splitIngredients } from "../constants/recipeLinks";
import {
  computeRecipeFields,
  propagateRecipeChange,
  hasPortionWeight,
  isEstimatedWeight,
} from "../api/recipeWeights";
import {
  nutritionKey,
  editorCopy,
  nameProblem,
  prepareGenerated,
  upsertSorted,
  dependentsNotice,
  dependentsFailedNotice,
  formItemFromRecipe,
  ERRORS,
} from "../lib/recipeBuilder.js";

const CLOSED = {
  open: false,
  input: "",
  preview: null,
  error: "",
  loading: false,
  recalcLoading: false,
  recalcError: "", // shown by the Recalculate button (save/generate errors show by Save)
  editId: null, // saved recipe being edited (null = new recipe)
  nutritionKey: null, // what the current nutrition was calculated from
  saving: false,
};

// Nutrition and, unless the user weighed the portion, a re-estimated Wt/portion.
const recalcFields = (recipe, recipes) =>
  computeRecipeFields(recipe, recipes, {
    keepWeight: hasPortionWeight(recipe) && !isEstimatedWeight(recipe),
  });

// Built on saved recipes → use their own nutrition and weights
async function generate(ctx, state, update) {
  update({ loading: true, error: "" });
  try {
    const names = ctx.userRecipes.map((r) => r.name);
    let recipe = prepareGenerated(await claudeCreateRecipe(state.input, names), genId());
    if (splitIngredients(recipe, ctx.userRecipes).linked.length)
      recipe = { ...recipe, ...(await computeRecipeFields(recipe, ctx.userRecipes)) };
    update({ preview: recipe, nutritionKey: nutritionKey(recipe) });
  } catch (err) {
    update({ error: err.message || ERRORS.generate });
  }
  update({ loading: false });
}

async function recalculate(ctx, state, update) {
  update({ recalcLoading: true, recalcError: "" });
  try {
    const fields = await recalcFields(state.preview, ctx.userRecipes);
    update((s) => ({ preview: { ...s.preview, ...fields } }));
    update({ nutritionKey: nutritionKey(state.preview) });
  } catch (err) {
    update({ recalcError: err.message || ERRORS.recalc });
  }
  update({ recalcLoading: false });
}

// Recipes that use this one are updated too
async function updateDependents(ctx, state, recipe) {
  ctx.setRecipeNotice(null);
  try {
    const { updated } = await propagateRecipeChange({
      uid: ctx.userId,
      oldA: state.editId ? ctx.userRecipes.find((r) => r.id === recipe.id) : null,
      newA: recipe,
      recipes: [...ctx.userRecipes.filter((r) => r.id !== recipe.id), recipe],
      setUserRecipes: ctx.setUserRecipes,
    });
    if (updated.length) ctx.setRecipeNotice(dependentsNotice(updated));
  } catch (err) {
    ctx.setRecipeNotice(dependentsFailedNotice(err));
  }
}

// Ingredients/servings changed since nutrition was last worked out → recalculate first
async function upToDate(ctx, state, update) {
  if (nutritionKey(state.preview) === state.nutritionKey) return state.preview;
  const recipe = { ...state.preview, ...(await recalcFields(state.preview, ctx.userRecipes)) };
  update({ preview: recipe, nutritionKey: nutritionKey(recipe) });
  return recipe;
}

async function saveRecipeAndDependents(ctx, state, update) {
  const recipe = await upToDate(ctx, state, update);
  await saveRecipe(ctx.userId, recipe);
  ctx.setUserRecipes((prev) => upsertSorted(prev, recipe));
  await updateDependents(ctx, state, recipe);
  if (!state.editId) ctx.setAddItem(formItemFromRecipe(recipe));
}

// ctx.close: closes the builder once saved
async function save(ctx, state, update) {
  const problem = nameProblem(state.preview, ctx.userRecipes);
  if (problem) return update({ error: problem });
  update({ saving: true, error: "" });
  try {
    await saveRecipeAndDependents(ctx, state, update);
    ctx.close();
  } catch (err) {
    update({ error: err.message || ERRORS.save });
  }
  update({ saving: false });
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

function useBuilderState() {
  const [state, setState] = useState(CLOSED);
  // fields: an object, or a function of the current state returning one
  const update = (fields) =>
    setState((s) => ({ ...s, ...(typeof fields === "function" ? fields(s) : fields) }));
  return [state, update];
}

export function useRecipeBuilder(ctx) {
  const [state, update] = useBuilderState();
  // Closing keeps in-flight flags: a pending request still finishes and clears its own
  const close = () => {
    update((s) => ({ ...CLOSED, ...pick(s, ["loading", "recalcLoading", "saving"]) }));
    if (state.editId) ctx.setShowRecipesModal(true); // back to the Saved Recipes list
  };
  return {
    ...state,
    stale: Boolean(state.preview) && nutritionKey(state.preview) !== state.nutritionKey,
    setInput: (input) => update({ input }),
    setPreview: (v) => update((s) => ({ preview: typeof v === "function" ? v(s.preview) : v })),
    startNew: ({ input = "", preview = null } = {}) =>
      update({ open: true, input, preview, error: "" }),
    openEditor: (recipe) => openEditor(ctx, recipe, update),
    // ×, Cancel and backdrop clicks are ignored while a save (with recalculation) is in flight
    requestClose: () => !state.saving && close(),
    generate: () => generate(ctx, state, update),
    recalculate: () => recalculate(ctx, state, update),
    save: () => save({ ...ctx, close }, state, update),
  };
}

function openEditor(ctx, recipe, update) {
  const copy = editorCopy(recipe);
  update({
    open: true,
    preview: copy,
    nutritionKey: nutritionKey(copy),
    editId: recipe.id,
    recalcError: "",
    input: "",
    error: "",
  });
  ctx.setShowRecipesModal(false);
}
