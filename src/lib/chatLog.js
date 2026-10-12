// src/lib/chatLog.js — the Claude chat: what is sent and kept, and its message list.
import { mealIdIn } from "./dayMeals.js";

/** Messages sent to Claude and kept as the conversation. */
export const CHAT_CONTEXT_LIMIT = 30;
export const lastMessages = (history) => history.slice(-CHAT_CONTEXT_LIMIT);

/** Size of the conversation sent with each message: a warning at 15 KB, no more messages at 20 KB. */
export const CHAT_WARN_BYTES = 15_000;
export const CHAT_MAX_BYTES = 20_000;
const encoder = new TextEncoder();
export const historyBytes = (history) =>
  history.reduce((n, m) => n + encoder.encode(String(m.content ?? "")).length, 0);

/** "ok", "warn" (15 KB or more) or "full" (20 KB or more). */
export const chatSize = (bytes) =>
  bytes >= CHAT_MAX_BYTES ? "full" : bytes >= CHAT_WARN_BYTES ? "warn" : "ok";

/** Roughly what sending that much costs per message, input only, in cents: 4 bytes a token at $3 per million. */
export const chatCostText = (bytes) => `${((bytes * 300) / 4e6).toFixed(2)}¢`;

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
