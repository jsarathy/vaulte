// src/hooks/useExerciseLog.js — state and actions of "Log Manual Exercise".
// ctx = { userId, allDays, addDate, currentDate, setCurrentDayData, persistDay }
import { useState } from "react";
import { genId, makeMeals, ensureMealSlots } from "../constants/helpers";
import { loadDay } from "../api/firestore";
import { exerciseEstimate, exerciseItem, mealIdIn, withItemInMeal } from "../lib/exerciseLog.js";

const START = {
  open: false,
  search: "",
  selected: null,
  durationText: "30",
  hrText: "",
  result: null,
  msg: null,
  mealId: "",
};

async function dayFor(ctx) {
  const saved =
    ctx.allDays.find((d) => d.date === ctx.addDate) || (await loadDay(ctx.userId, ctx.addDate));
  return ensureMealSlots(saved || { date: ctx.addDate, notes: "", meals: makeMeals() });
}

async function logExercise(ctx, state, update) {
  if (!state.mealId) return update({ msg: { ok: false, text: "Select a meal slot" } });
  try {
    const day = await dayFor(ctx);
    const mealId = mealIdIn(day, state.mealId);
    if (!mealId) return update({ msg: { ok: false, text: "Meal slot not found — try again" } });
    const updated = withItemInMeal(
      day,
      mealId,
      exerciseItem(state.selected, state.result, genId()),
    );
    await ctx.persistDay(updated);
    if (ctx.addDate === ctx.currentDate) ctx.setCurrentDayData(updated);
    update(START); // after logging the form starts again (closed)
  } catch (e) {
    update({ msg: { ok: false, text: "Failed to log: " + e.message } });
  }
}

export function useExerciseLog(ctx) {
  const [state, setState] = useState(START);
  const update = (fields) => setState((s) => ({ ...s, ...fields }));
  return {
    ...state,
    // Opening clears the search, pick and result; duration and HR are kept
    show: () => update({ open: true, search: "", selected: null, result: null, msg: null }),
    close: () => update({ open: false }),
    setSearch: (search) => update({ search }),
    pick: (selected) => update({ selected, result: null }),
    setDuration: (durationText) => update({ durationText }),
    setHr: (hrText) => update({ hrText }),
    setMealId: (mealId) => update({ mealId }),
    calculate: () => {
      const result = exerciseEstimate(state.selected, state);
      if (result) update({ result });
    },
    log: () => logExercise(ctx, state, update),
  };
}
