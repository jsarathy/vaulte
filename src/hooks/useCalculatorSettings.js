// src/hooks/useCalculatorSettings.js — the reference calculator's inputs (Compare tab; also used
// by the Daily log). Restored when the tracker loads, saved 600 ms after any later change.
import { useEffect, useRef, useState } from "react";
import { saveCalculator } from "../api/trackerData";
import { CALCULATOR_DEFAULTS, calculatorFromDoc } from "../lib/trackerStart.js";

// Saving waits until the saved values have been read, so the defaults never overwrite them.
// The restored values are saved back once (the effect sees them change).
function useSaveOnChange(userId, values) {
  const loaded = useRef(false);
  useEffect(() => {
    if (!userId || !loaded.current) return;
    const t = setTimeout(() => {
      saveCalculator(userId, values).catch((e) => console.error("calculator save failed", e));
    }, 600);
    return () => clearTimeout(t);
  }, [userId, values]);
  return loaded;
}

// Like separate useState setters: a value equal to the current one changes nothing
const merged = (prev, changes) =>
  Object.keys(changes).every((k) => Object.is(prev[k], changes[k]))
    ? prev
    : { ...prev, ...changes };

export function useCalculatorSettings(userId) {
  const [values, setValues] = useState(CALCULATOR_DEFAULTS);
  const loaded = useSaveOnChange(userId, values);
  const setter = (key) => (v) => setValues((prev) => merged(prev, { [key]: v }));
  return {
    values,
    setters: {
      setCalcSex: setter("sex"),
      setCalcAge: setter("age"),
      setCalcHeight: setter("height"),
      setCalcWeight: setter("weight"),
      setCalcProtein: setter("protein"),
      setCalcFatPct: setter("fatPct"),
    },
    restore: (saved) => setValues((prev) => merged(prev, calculatorFromDoc(saved))),
    markLoaded: () => (loaded.current = true),
  };
}
