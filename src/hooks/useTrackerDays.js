// src/hooks/useTrackerDays.js — saving a day (Compare follows), deleting an entry, opening a day.
// ctx = { userId, allDays, setAllDays, currentDayData, setCurrentDate, setCurrentDayData,
//         compare: { slots, data }, setCompareSlots, setCompareData, setChatDate, setChatMealId }
import { ensureMealSlots } from "../constants/helpers";
import { saveDay, loadDay } from "../api/firestore";
import { compareAfterSave, withSavedDay, withoutItem } from "../lib/trackerDays.js";

// (sic) The Daily log shows the saved day, even when another day is open — kept as is
async function persistDay(ctx, day) {
  await saveDay(ctx.userId, day);
  ctx.setAllDays((prev) => withSavedDay(prev, day));
  ctx.setCurrentDayData(day);
  const compare = compareAfterSave(ctx.compare, day, ctx.allDays);
  if (!compare) return;
  ctx.setCompareSlots(compare.slots);
  ctx.setCompareData(compare.data);
}

// A day not loaded yet is read from Firestore; the chat moves to it (as a question)
async function switchDay(ctx, date) {
  ctx.setCurrentDate(date);
  const day = ctx.allDays.find((d) => d.date === date) || (await loadDay(ctx.userId, date));
  ctx.setCurrentDayData(ensureMealSlots(day));
  ctx.setChatDate(date);
  ctx.setChatMealId("__chat__");
}

export function useTrackerDays(ctx) {
  const persist = (day) => persistDay(ctx, day);
  return {
    persistDay: persist,
    switchDay: (date) => switchDay(ctx, date),
    deleteItem: async (mealId, itemId) => {
      if (ctx.currentDayData) await persist(withoutItem(ctx.currentDayData, mealId, itemId));
    },
  };
}
