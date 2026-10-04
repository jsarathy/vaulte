// src/hooks/useMonthlyTargets.js — loads and auto-saves one month's targets
// (users/{uid}/monthly_targets/{YYYY-MM}).
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { EMPTY_TARGETS, fromTargetDoc, toTargetDoc } from "../lib/monthlyTargets";

const SAVE_DELAY_MS = 600;
const targetsRef = (userId, monthKey) => doc(db, "users", userId, "monthly_targets", monthKey);

// Loads the month into state. Returns a cleanup so a reply for a month no longer shown is ignored.
function loadMonth({ userId, monthKey, setVals, setStatus, loadedKey }) {
  const live = { on: true };
  loadedKey.current = null;
  setVals(EMPTY_TARGETS);
  setStatus("");
  const loaded = (snap) => {
    if (!live.on) return;
    setVals(fromTargetDoc(snap.exists() ? snap.data() : {}));
    loadedKey.current = monthKey;
  };
  const failed = (e) => {
    console.error("monthly targets load failed:", e);
    if (!live.on) return;
    setStatus("error");
    loadedKey.current = monthKey;
  };
  getDoc(targetsRef(userId, monthKey)).then(loaded).catch(failed);
  return () => (live.on = false);
}

function scheduleSave(timer, save) {
  clearTimeout(timer.current);
  timer.current = setTimeout(save, SAVE_DELAY_MS);
}

async function saveMonth({ userId, monthKey, vals, setStatus }) {
  try {
    await setDoc(targetsRef(userId, monthKey), toTargetDoc(monthKey, vals));
    setStatus("saved");
  } catch (e) {
    console.error("monthly targets save failed:", e);
    setStatus("error");
  }
}

/** { vals, status, onChange }. status: "", "saving…", "saved" or "error". */
export function useMonthlyTargets(userId, monthKey) {
  const [vals, setVals] = useState(EMPTY_TARGETS);
  const [status, setStatus] = useState("");
  const loadedKey = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    if (!userId) return undefined;
    return loadMonth({ userId, monthKey, setVals, setStatus, loadedKey });
  }, [userId, monthKey]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Auto-save shortly after any change, once this month's doc has loaded.
  const onChange = (key, value) => {
    const next = { ...vals, [key]: value };
    setVals(next);
    if (loadedKey.current !== monthKey) return;
    setStatus("saving…");
    scheduleSave(timer, () => saveMonth({ userId, monthKey, vals: next, setStatus }));
  };
  return { vals, status, onChange };
}
