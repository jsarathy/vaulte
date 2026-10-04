// src/hooks/useAddFood.js — the "Add Food Item" form: name list, macros, Clear and Add Item.
// ctx = { userId, allDays, userRecipes, addDate, setAddDate, addMealId, setAddMealId,
//         addMealName, currentDate, addItem, setAddItem, addMsg, setAddMsg, persistDay,
//         setCurrentDayData, lookup, portion }
import { useState } from "react";
import { genId } from "../constants/helpers";
import { dayForEdit } from "../api/dayForEdit";
import { withItemsInMeal } from "../lib/dayMeals.js";
import {
  EMPTY_FOOD,
  findSavedRecipe,
  foodEntry,
  foodMealOptions,
  hasNutrition,
  mealForFood,
  recipesMatching,
  withMacro,
} from "../lib/addFood.js";

async function addToDay(ctx, item) {
  const saved = await dayForEdit(ctx.userId, ctx.allDays, ctx.addDate);
  const choice = { mealId: ctx.addMealId, mealName: ctx.addMealName };
  const { day, mealId } = mealForFood(saved, choice, genId);
  if (!mealId) return ctx.setAddMsg({ ok: false, text: "Please select or create a meal" });
  const updated = withItemsInMeal(day, mealId, [foodEntry(item, genId())]);
  await ctx.persistDay(updated);
  if (ctx.addDate === ctx.currentDate) ctx.setCurrentDayData(updated);
  ctx.setAddMsg({ ok: true, text: "✅ Item added!" });
  ctx.setAddItem(EMPTY_FOOD);
  setTimeout(() => ctx.setAddMsg(null), 3000);
}

// Add Item with no nutrition: a saved recipe opens its portion box, anything else is looked up
// and then added
function submit(ctx, openPortion) {
  const { addItem } = ctx;
  if (!addItem.name) return ctx.setAddMsg({ ok: false, text: "Please enter a food name" });
  if (hasNutrition(addItem)) return addToDay(ctx, addItem);
  const saved = findSavedRecipe(ctx.userRecipes, addItem.name);
  if (saved) return openPortion(saved);
  ctx.lookup.open(addItem.name, { autoSubmit: true });
}

// Leaving the name field: a saved recipe opens its portion box, a new food opens Get Nutrition
// at 1 portion. Skipped while a box is open (incl. a recipe just picked from the list).
function checkName(ctx, openPortion) {
  if (ctx.lookup.isOpenRef.current || ctx.portion.isOpenRef.current) return;
  const name = ctx.addItem.name.trim();
  if (!name || hasNutrition(ctx.addItem)) return;
  const saved = findSavedRecipe(ctx.userRecipes, name);
  if (saved) return openPortion(saved);
  ctx.lookup.open(name);
}

// Saved recipes containing the typed name, from 2 characters
function useNameList(ctx) {
  const [list, setList] = useState([]);
  const [shown, setShown] = useState(false);
  const typed = (name) => {
    if (name.length < 2) return setShown(false);
    const matches = recipesMatching(ctx.userRecipes, name);
    setList(matches);
    setShown(matches.length > 0);
  };
  return { list, shown, setShown, typed, focus: () => list.length > 0 && setShown(true) };
}

function nameHandlers(ctx, names, openPortion) {
  return {
    onChange: (e) => {
      ctx.setAddItem({ ...ctx.addItem, name: e.target.value });
      names.typed(e.target.value);
    },
    onBlur: () =>
      setTimeout(() => {
        names.setShown(false);
        checkName(ctx, openPortion);
      }, 150),
    // Enter on an exact saved name opens its portion box at once; otherwise blur decides
    onKeyDown: (e) => {
      const saved = e.key === "Enter" && findSavedRecipe(ctx.userRecipes, ctx.addItem.name);
      if (!saved) return;
      e.preventDefault();
      openPortion(saved);
    },
    onFocus: names.focus,
  };
}

export function useAddFood(ctx) {
  const names = useNameList(ctx);
  const openPortion = (recipe) => {
    names.setShown(false);
    ctx.portion.open(recipe);
  };
  return {
    item: ctx.addItem,
    msg: ctx.addMsg,
    day: { date: ctx.addDate, setDate: ctx.setAddDate, mealId: ctx.addMealId },
    setMealId: ctx.setAddMealId,
    mealOptions: foodMealOptions(ctx.allDays, ctx.addDate),
    names: { list: names.list, shown: names.shown, pick: openPortion },
    name: nameHandlers(ctx, names, openPortion),
    setMacro: (key, value) => ctx.setAddItem(withMacro(ctx.addItem, key, value)),
    clear: () => ctx.setAddItem(EMPTY_FOOD),
    submit: () => submit(ctx, openPortion),
    addToDay: (item) => addToDay(ctx, item),
  };
}
