// src/hooks/useWeightEntry.js — the weight entry box (Weight tab: click a calendar date).
// ctx = { userId, weightLog, setWeightLog }
import { useState } from "react";
import { saveWeightRow, deleteWeightRow } from "../api/weightLog";
import { entryFor, weightRow, withWeightRow, withoutWeightRow } from "../lib/weightEntry.js";

// A failed write is logged and the box stays open, unchanged
async function save(ctx, entry, setEntry) {
  if (!entry || !ctx.userId) return;
  const row = weightRow(entry);
  try {
    await saveWeightRow(ctx.userId, row);
  } catch (e) {
    return console.error("weight save failed", e);
  }
  ctx.setWeightLog((prev) => withWeightRow(prev, row));
  setEntry(null);
}

async function remove(ctx, entry, setEntry) {
  if (!entry || !ctx.userId) return;
  try {
    await deleteWeightRow(ctx.userId, entry.date);
  } catch (e) {
    return console.error("weight delete failed", e);
  }
  ctx.setWeightLog((prev) => withoutWeightRow(prev, entry.date));
  setEntry(null);
}

export function useWeightEntry(ctx) {
  const [entry, setEntry] = useState(null);
  return {
    entry,
    setEntry,
    open: (date) => setEntry(entryFor(ctx.weightLog, date)),
    save: () => save(ctx, entry, setEntry),
    remove: () => remove(ctx, entry, setEntry),
  };
}
