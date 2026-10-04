// src/components/MonthlyTargetsCard.jsx — monthly targets form (left column, under the calendar).
// One Firestore doc per month: users/{uid}/monthly_targets/{YYYY-MM}. Follows the month shown on the calendar.
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { C, FONT } from "../constants/design.jsx";

// key, label, unit, step, tolerance note
export const TARGET_FIELDS = [
  { key: "weightKg", label: "Weight", unit: "kg", step: "0.1", tol: "± 0.2 kg" },
  { key: "waistCm", label: "Waist", unit: "cm", step: "0.5", tol: "± 1 cm" },
  { key: "gym", label: "Gym sessions", unit: "", step: "1" },
  { key: "golf", label: "Golf sessions", unit: "", step: "1" },
  { key: "sleepHrs", label: "Sleep (avg)", unit: "hrs", step: "0.25" },
];
const TOLERANCE = { weightKg: 0.2, waistCm: 1 };
const EMPTY = Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, ""]));

export default function MonthlyTargetsCard({ userId, year, month }) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
  const [vals, setVals] = useState(EMPTY);
  const [status, setStatus] = useState(""); // "", "saving…", "saved", "error"
  const loadedKey = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadedKey.current = null;
    setVals(EMPTY);
    setStatus("");
    getDoc(doc(db, "users", userId, "monthly_targets", monthKey))
      .then((s) => {
        if (cancelled) return;
        const d = s.exists() ? s.data() : {};
        setVals(Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, d[f.key] ?? ""])));
        loadedKey.current = monthKey;
      })
      .catch((e) => {
        console.error("monthly targets load failed:", e);
        if (!cancelled) {
          setStatus("error");
          loadedKey.current = monthKey;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, monthKey]);

  // Auto-save shortly after any change (only once this month's doc has loaded).
  const save = (next) => {
    if (loadedKey.current !== monthKey) return;
    clearTimeout(timer.current);
    setStatus("saving…");
    timer.current = setTimeout(async () => {
      const out = { month: monthKey, tolerance: TOLERANCE, updated_at: new Date().toISOString() };
      TARGET_FIELDS.forEach((f) => {
        const n = parseFloat(next[f.key]);
        out[f.key] = Number.isFinite(n) ? n : null;
      });
      try {
        await setDoc(doc(db, "users", userId, "monthly_targets", monthKey), out);
        setStatus("saved");
      } catch (e) {
        console.error("monthly targets save failed:", e);
        setStatus("error");
      }
    }, 600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (key, v) => {
    const next = { ...vals, [key]: v };
    setVals(next);
    save(next);
  };

  const inp = {
    width: "100%",
    boxSizing: "border-box",
    padding: "3px 6px",
    border: `0.5px solid ${C.borderMid}`,
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: FONT.mono,
    textAlign: "right",
    outline: "none",
    background: "#fff",
  };

  return (
    <div style={{ borderTop: `0.5px solid ${C.border}`, padding: "10px 12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: C.muted,
          }}
        >
          Targets · {monthLabel}
        </span>
        <span style={{ fontSize: "10px", color: status === "error" ? C.danger : C.hint }}>
          {status === "error" ? "not saved" : status}
        </span>
      </div>
      {TARGET_FIELDS.map((f) => (
        <div key={f.key} style={{ marginBottom: "6px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: C.hint,
              marginBottom: "2px",
            }}
          >
            <span>
              {f.label}
              {f.unit ? ` (${f.unit})` : ""}
            </span>
            {f.tol && <span>{f.tol}</span>}
          </div>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step={f.step}
            value={vals[f.key]}
            placeholder="—"
            onChange={(e) => onChange(f.key, e.target.value)}
            style={inp}
          />
        </div>
      ))}
    </div>
  );
}
