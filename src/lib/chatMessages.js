// src/lib/chatMessages.js — what the chat window shows besides the messages themselves: the
// meals offered for the chosen day, the history count, the input's prompt, and a food
// preview's table cells and totals.
import { DEFAULT_MEAL_SLOTS, ensureMealSlots, fmt } from "../constants/helpers.js";

export const CHAT_MODE = "__chat__";

const asSlot = (m) => ({ id: "__slot__" + m.name, name: m.name, is_exercise: m.is_exercise });

/** The day's meals with the default slots it lacks offered by name ("__slot__<name>"). */
function withSlots(day) {
  const ids = new Set((day.meals || []).map((m) => m.id));
  return ensureMealSlots(day).meals.map((m) => (ids.has(m.id) ? m : asSlot(m)));
}

/**
 * The meals offered for the chat's day: the stored day's (else the open day's, when it is that
 * day) with missing default slots by name; a day with neither, the default slots. Exercise
 * slots left out.
 */
export function mealsForDate(allDays, date, currentDayData) {
  const stored = allDays.find((d) => d.date === date);
  const day = stored || (currentDayData?.date === date ? currentDayData : null);
  const meals = day ? withSlots(day) : DEFAULT_MEAL_SLOTS.map(asSlot);
  return meals.filter((m) => !m.is_exercise).map(({ id, name }) => ({ id, name }));
}

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
