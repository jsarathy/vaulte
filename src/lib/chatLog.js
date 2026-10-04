// src/lib/chatLog.js — the Claude chat: what is sent and kept, and its message list.

/** Messages sent to Claude and kept as the conversation. */
export const CHAT_CONTEXT_LIMIT = 30;
export const lastMessages = (history) => history.slice(-CHAT_CONTEXT_LIMIT);

/** The message list with one message changed. */
export const withMessage = (messages, id, changes) =>
  messages.map((m) => (m.id === id ? { ...m, ...changes } : m));

/** Name of the chosen meal on the chat's day (the open day when not loaded), else "Meal". */
export const chatMealName = ({ allDays, chatDate, currentDayData, chatMealId }) =>
  (allDays.find((d) => d.date === chatDate) || currentDayData)?.meals?.find(
    (m) => m.id === chatMealId,
  )?.name || "Meal";
