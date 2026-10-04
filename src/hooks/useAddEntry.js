// src/hooks/useAddEntry.js — all of Add Entry's parts, wired together. p = AddEntry's props.
import { useSavedRecipes } from "./useSavedRecipes";
import { useRecipeBuilder } from "./useRecipeBuilder";
import { useRecipePortion } from "./useRecipePortion";
import { useFoodLookup } from "./useFoodLookup";
import { useAddFood } from "./useAddFood";
import { usePhotoLog } from "./usePhotoLog";
import { useExerciseLog } from "./useExerciseLog";
import { usePolarBrowse } from "./usePolarBrowse";

// Saved recipes, the builder and the portion box ("How much?" before adding a saved recipe)
function useRecipeTools(p) {
  const saved = useSavedRecipes(p);
  const builder = useRecipeBuilder({
    ...p,
    setRecipeNotice: saved.setNotice,
    setShowRecipesModal: saved.setOpen,
  });
  const portion = useRecipePortion();
  const loadPortion = (item) => {
    p.setAddItem(item);
    portion.close();
    saved.setOpen(false);
  };
  return { saved, builder, portion, loadPortion };
}

export function useAddEntry(p) {
  const recipes = useRecipeTools(p);
  const { builder, portion } = recipes;
  // "Get Nutrition" box for a food that isn't a saved recipe
  const lookup = useFoodLookup({
    ...p,
    addToDay: (item) => food.addToDay(item),
    startRecipe: (name) => builder.startNew({ input: name }),
  });
  const food = useAddFood({ ...p, lookup, portion });
  const photo = usePhotoLog({ ...p, startRecipe: (preview) => builder.startNew({ preview }) });
  const exercise = useExerciseLog(p);
  const browse = usePolarBrowse(p.userId);
  return { ...recipes, lookup, food, photo, exercise, browse };
}
