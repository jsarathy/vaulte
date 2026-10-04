// src/hooks/usePhotoLog.js — "Log from Photo": analyse a photo, then load, log or save the foods.
// ctx = { userId, allDays, addDate, addMealId, currentDate, setCurrentDayData, persistDay,
//         setAddItem, setAddMsg, startRecipe(preview) }
import { useRef, useState } from "react";
import { genId } from "../constants/helpers";
import { dayForEdit } from "../api/dayForEdit";
import { preparePhoto, claudeIdentifyFoods } from "../api/photoLog";
import { fileToPreviewURL } from "../utils/imageUtils";
import { PHOTO_ERROR, formItemFromPhoto, photoRecipe } from "../lib/photoLog.js";
import { mealIdIn, withItemsInMeal } from "../lib/dayMeals.js";

// Shows the original photo at once, then the reduced copy that is sent to Claude
async function analyse(raw, set) {
  set.loading(true);
  set.error("");
  set.items([]);
  const firstPreview = fileToPreviewURL(raw);
  set.preview(firstPreview);
  try {
    const file = await preparePhoto(raw);
    URL.revokeObjectURL(firstPreview);
    set.preview(fileToPreviewURL(file));
    set.items(await claudeIdentifyFoods(file));
  } catch {
    set.error(PHOTO_ERROR);
  } finally {
    set.loading(false);
  }
}

async function logAll(ctx, items, clear) {
  const day = await dayForEdit(ctx.userId, ctx.allDays, ctx.addDate);
  const mealId = mealIdIn(day, ctx.addMealId);
  if (!mealId) return ctx.setAddMsg({ ok: false, text: "Select a meal slot first" });
  const added = items.map((i) => ({ ...i, id: genId() }));
  const updated = withItemsInMeal(day, mealId, added);
  await ctx.persistDay(updated);
  if (ctx.addDate === ctx.currentDate) ctx.setCurrentDayData(updated);
  clear();
  ctx.setAddMsg({ ok: true, text: `✅ ${added.length} items logged from photo!` });
  setTimeout(() => ctx.setAddMsg(null), 3000);
}

function usePhotoState() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const set = { loading: setLoading, preview: setPreview, items: setItems, error: setError };
  return [{ loading, preview, items, error }, set];
}

// The input is emptied afterwards so the same photo can be chosen again
function onFile(e, set) {
  const raw = e.target.files?.[0];
  if (raw) analyse(raw, set).finally(() => (e.target.value = ""));
}

export function usePhotoLog(ctx) {
  const [state, set] = usePhotoState();
  const inputRef = useRef(null);
  const clear = () => {
    set.items([]);
    set.preview(null);
  };
  return {
    ...state,
    inputRef,
    choose: () => inputRef.current?.click(),
    onFile: (e) => onFile(e, set),
    load: (item) => ctx.setAddItem(formItemFromPhoto(item)),
    logAll: () => logAll(ctx, state.items, clear),
    saveAsRecipe: () => {
      ctx.startRecipe(photoRecipe(state.items, genId()));
      clear();
    },
  };
}
