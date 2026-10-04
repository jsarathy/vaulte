// src/api/dayForEdit.js — the day that Add Entry adds entries to.
import { makeMeals } from "../constants/helpers";
import { loadDay } from "./firestore";

/** In memory, else stored, else a new day with the default meals. */
export async function dayForEdit(userId, allDays, date) {
  const saved = allDays.find((d) => d.date === date) || (await loadDay(userId, date));
  return saved || { date, notes: "", meals: makeMeals() };
}
