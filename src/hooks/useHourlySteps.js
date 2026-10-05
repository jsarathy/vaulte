// src/hooks/useHourlySteps.js — state for the Steps-by-hour card: the browsed date and its picker,
// the live apple_activity hourly map, hover, and the full-screen view (Esc, measured area).
import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const showPicker = (el) => {
  try {
    el.showPicker();
  } catch {
    el.focus();
    el.click();
  }
};

// Own date, so any day can be browsed; follows the Add Entry date when that changes.
export function useBrowseDate(dateProp) {
  const [date, setDate] = useState(dateProp);
  useEffect(() => {
    setDate(dateProp);
  }, [dateProp]);
  const pickerRef = useRef(null);
  const openPicker = (e) => {
    e?.stopPropagation();
    if (pickerRef.current) showPicker(pickerRef.current);
  };
  return { date, setDate, pickerRef, openPicker };
}

export function useHourlyDoc(userId, date) {
  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId || !date) return;
    setLoading(true);
    const ref = doc(db, "users", userId, "apple_activity", date);
    const onDoc = (s) => {
      setHourly(s.exists() ? s.data().hourly || null : null);
      setLoading(false);
    };
    const onError = (e) => {
      console.error("hourly steps listen failed:", e);
      onDoc({ exists: () => false });
    };
    return onSnapshot(ref, onDoc, onError);
  }, [userId, date]);
  return { hourly, loading };
}

const useEscape = (active, setActive) =>
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setActive(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, setActive]);

const useMeasured = (active, ref, setBox) =>
  useEffect(() => {
    if (!active || !ref.current || typeof ResizeObserver === "undefined") return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, ref, setBox]);

export function useFullScreen() {
  const [full, setFull] = useState(false);
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEscape(full, setFull);
  useMeasured(full, boxRef, setBox);
  return { full, setFull, boxRef, box };
}

export function useHourlyStepsCard({ userId, date: dateProp }) {
  const browse = useBrowseDate(dateProp);
  const [hover, setHover] = useState(null);
  const screen = useFullScreen();
  useEffect(() => {
    setHover(null);
  }, [screen.full, browse.date]);
  return { ...browse, ...screen, ...useHourlyDoc(userId, browse.date), hover, setHover };
}
