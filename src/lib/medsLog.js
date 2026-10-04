// src/lib/medsLog.js — the Meds panel's view of a day's routine_log entries.
import { medsForDate, hasText } from "../constants/meds.js";

/** The meds that apply on the date, each with its typed text and whether it counts as taken. */
export function medsView(date, entries) {
  const meds = medsForDate(date).map((t) => ({
    ...t,
    value: entries[t.id]?.text || "",
    filled: hasText(entries[t.id]),
  }));
  return { meds, done: meds.filter((m) => m.filled).length, total: meds.length };
}

/** Typing replaces the med's entry (a legacy "done" flag goes with it). */
export const withEntry = (entries, id, text) => ({ ...entries, [id]: { text } });

/** What is merged into routine_log/{date}. */
export const medsDoc = (entries, date, now) => ({ entries, date, updatedAt: now.toISOString() });
