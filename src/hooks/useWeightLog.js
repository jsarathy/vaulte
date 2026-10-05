// src/hooks/useWeightLog.js — the Weight tab's log: table rows, editing a row (saved on every
// change; a failed save is logged and the screen keeps the edit), and purging rows before the
// sync cutoff after confirming.
import { saveWeightRow } from "../api/weightLog.js";
import {
  editedRow,
  purgePrompt,
  staleCount,
  syncFromOf,
  tableRows,
} from "../lib/weightLogTable.js";

async function saveField({ userId, weightLog, setWeightLog }, i, fields) {
  const row = editedRow(weightLog, i, fields);
  if (!row) return;
  setWeightLog(weightLog.map((r, j) => (j === i ? row : r)));
  try {
    await saveWeightRow(userId, row);
  } catch (e) {
    console.error("weight row save failed", e);
  }
}

async function purge({ purgeBefore }, syncFrom, count) {
  if (!syncFrom || !window.confirm(purgePrompt(count, syncFrom))) return;
  await purgeBefore(syncFrom);
}

/** props: { userId, weightLog, setWeightLog, cfg, purgeBefore } */
export default function useWeightLog(props) {
  const syncFrom = syncFromOf(props.cfg);
  const stale = staleCount(props.weightLog, syncFrom);
  return {
    rows: tableRows(props.weightLog, props.cfg, new Date()),
    syncFrom,
    stale,
    saveField: (i, key, value) => saveField(props, i, { [key]: value }),
    purge: () => purge(props, syncFrom, stale),
  };
}
