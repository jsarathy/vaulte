// src/hooks/useBodyLog.js — the Body tab's log actions: changing a reading, deleting a row, and
// the Renpho tape sync (one at a time; its message shows for 6 s).
import { useState } from "react";
import { deleteBodyRow, fetchTapeRecords, saveBodyRow } from "../api/bodyLog.js";
import { mergeTapeRecords, syncedText, syncError, withReading } from "../lib/bodyLog.js";

export function useBodyLogEdits(userId, bodyLog, setBodyLog) {
  const saveField = async (i, key, val) => {
    if (!bodyLog[i]?.date) return;
    const { row, rows } = withReading(bodyLog, i, { [key]: val });
    setBodyLog(rows);
    await saveBodyRow(userId, row).catch((e) => console.error("body row save failed", e));
  };
  const deleteRow = async (row) => {
    if (!row?.date) return;
    if (!window.confirm(`Delete body measurements for ${row.date}?`)) return;
    try {
      await deleteBodyRow(userId, row.date);
    } catch (e) {
      console.error("body row delete failed", e);
      return;
    }
    setBodyLog((prev) => prev.filter((r) => r.date !== row.date));
  };
  return { saveField, deleteRow };
}

// The sync's result message ({ ok, text }); throws on a failed reply or save.
async function syncTape(userId, bodyLog, setBodyLog) {
  const { ok, status, data } = await fetchTapeRecords(userId);
  if (!ok) throw new Error(syncError(status, data));
  const records = data.records || [];
  if (!records.length) return { ok: true, text: "No tape measurements found." };
  const { merged, rows } = mergeTapeRecords(bodyLog, records);
  await Promise.all(merged.map((row) => saveBodyRow(userId, row)));
  setBodyLog(rows);
  return { ok: true, text: syncedText(merged.length) };
}

export function useTapeSync(userId, bodyLog, setBodyLog) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const syncBody = async () => {
    if (syncing || !userId) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      setSyncMsg(await syncTape(userId, bodyLog, setBodyLog));
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message });
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 6000);
  };
  return { syncing, syncMsg, syncBody };
}
