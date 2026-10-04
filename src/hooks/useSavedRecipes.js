// src/hooks/useSavedRecipes.js — the Saved Recipes list: open/closed, its notice, deleting.
// ctx = { userId, userRecipes, setUserRecipes }
import { useState } from "react";
import { deleteRecipe } from "../api/firestore";
import { findDependentsDeep } from "../constants/recipeLinks";
import { deleteConfirmText, deletedNotice, withoutRecipes } from "../lib/savedRecipes.js";

// Recipes built on this one (directly or indirectly) go too — they can't be worked out without it
async function removeWithDependents(ctx, recipe, setNotice) {
  const dependents = findDependentsDeep(recipe, ctx.userRecipes);
  if (!confirm(deleteConfirmText(recipe, dependents))) return;
  const gone = [recipe, ...dependents];
  for (const r of gone) await deleteRecipe(ctx.userId, r.id);
  ctx.setUserRecipes((prev) => withoutRecipes(prev, gone));
  setNotice(deletedNotice(recipe, dependents));
}

/** notice: { ok, text } shown above the list (e.g. recipes updated after a save). */
export function useSavedRecipes(ctx) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  return {
    open,
    notice,
    setOpen,
    setNotice,
    // × also clears the notice; the backdrop just closes
    close: () => {
      setOpen(false);
      setNotice(null);
    },
    remove: (recipe) => removeWithDependents(ctx, recipe, setNotice),
  };
}
