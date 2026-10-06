// src/lib/chatLog.js — the Claude chat: what is sent and kept, and its message list.
import { mealIdIn } from "./dayMeals.js";

/** Messages sent to Claude and kept as the conversation. */
export const CHAT_CONTEXT_LIMIT = 30;
export const lastMessages = (history) => history.slice(-CHAT_CONTEXT_LIMIT);

/** The message list with one message changed. */
export const withMessage = (messages, id, changes) =>
  messages.map((m) => (m.id === id ? { ...m, ...changes } : m));

const SLOT = "__slot__";

/** Name of the chosen meal: a slot's own name, else the meal on the chat's day (the open day
 *  when not loaded), else "Meal". */
export function chatMealName({ allDays, chatDate, currentDayData, chatMealId }) {
  if (chatMealId?.startsWith(SLOT)) return chatMealId.slice(SLOT.length);
  const day = allDays.find((d) => d.date === chatDate) || currentDayData;
  return day?.meals?.find((m) => m.id === chatMealId)?.name || "Meal";
}

/** The chosen meal's id in the day being logged to (a slot by name); null if it isn't there. */
export function chatMealIn(day, value) {
  const id = mealIdIn(day, value);
  return day.meals.some((m) => m.id === id) ? id : null;
}

export const mealNotFound = (date) => `Couldn't find that meal on ${date} — nothing was logged.`;
