// src/lib/chatMessages.js — what the chat window shows besides the messages themselves: the
// meals offered for the chosen day, the history count, the input's prompt, and a food
// preview's table cells and totals.
import { fmt } from "../constants/helpers.js";

export const CHAT_MODE = "__chat__";

/** The meals of the chosen day (the open day when it isn't stored), exercise slots left out. */
export const mealsForDate = (allDays, date, currentDayData) =>
  (allDays.find((d) => d.date === date) || currentDayData)?.meals?.filter((m) => !m.is_exercise) ||
  [];

/** "N messages", or "Last N messages" once the history is at the limit sent to Claude. */
export const historyLabel = (count, limit) =>
  count >= limit ? `Last ${limit} messages` : `${count} messages`;

export const placeholderFor = (mealId) =>
  mealId === CHAT_MODE ? "Ask me anything…" : "Describe what you ate…";

export const loggedLabel = (items) => `Logged ${items.length} item${items.length !== 1 ? "s" : ""}`;

export const PREVIEW_COLUMNS = ["Item", "kcal", "Fat", "Carbs", "Fibre", "Prot"];
const FIELDS = ["kcal", "fat", "carbs", "fibre", "protein"];

/** A preview row's numbers in column order. */
export const itemValues = (item) => FIELDS.map((f) => item[f]);

/** The totals row's numbers. */
export const previewTotals = (items) => FIELDS.map((f) => items.reduce((s, i) => s + i[f], 0));

/** A number as shown in the table: grams after every column but kcal. */
export const cellText = (value, column) => fmt(value) + (column > 0 ? "g" : "");

/** Message text as HTML with line breaks. */
export const asHtml = (text) => text.replace(/\n/g, "<br/>");
