// src/hooks/useMeds.js — the Meds panel: load the day's entries, type, save on leaving a field.
import { useEffect, useRef, useState } from "react";
import { loadMeds, saveMeds } from "../api/medsLog";
import { medsView, withEntry } from "../lib/medsLog.js";

// A load that finishes after the day has changed is ignored
function useDayEntries(userId, date) {
  const [entries, setEntries] = useState({});
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!userId || !date) return;
    let cancelled = false;
    setBusy(true);
    loadMeds(userId, date)
      .then((loaded) => !cancelled && setEntries(loaded))
      .catch((e) => console.error("Meds load error:", e))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [userId, date]);
  return { entries, setEntries, busy };
}

export function useMeds(userId, date) {
  const { entries, setEntries, busy } = useDayEntries(userId, date);
  const latest = useRef({});
  useEffect(() => {
    latest.current = entries;
  }, [entries]);
  return {
    busy,
    ...medsView(date, entries),
    type: (id, text) => setEntries((prev) => withEntry(prev, id, text)),
    save: () => saveMeds(userId, date, latest.current),
  };
}
