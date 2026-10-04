// src/lib/monthlyTargets.js — monthly targets form fields and their Firestore shape.

// key, label, unit, input step, tolerance note
export const TARGET_FIELDS = [
  { key: "weightKg", label: "Weight", unit: "kg", step: "0.1", tol: "± 0.2 kg" },
  { key: "waistCm", label: "Waist", unit: "cm", step: "0.5", tol: "± 1 cm" },
  { key: "gym", label: "Gym sessions", unit: "", step: "1" },
  { key: "golf", label: "Golf sessions", unit: "", step: "1" },
  { key: "sleepHrs", label: "Sleep (avg)", unit: "hrs", step: "0.25" },
];
export const TOLERANCE = { weightKg: 0.2, waistCm: 1 };
export const EMPTY_TARGETS = Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, ""]));

export const monthKeyOf = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;

export const monthLabelOf = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** Firestore doc → form values ("" for anything not set). */
export const fromTargetDoc = (data) =>
  Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, data[f.key] ?? ""]));

/** Form values → Firestore doc: numbers, or null when blank, with the tolerances alongside. */
export function toTargetDoc(monthKey, vals) {
  const out = { month: monthKey, tolerance: TOLERANCE, updated_at: new Date().toISOString() };
  for (const f of TARGET_FIELDS) {
    const n = parseFloat(vals[f.key]);
    out[f.key] = Number.isFinite(n) ? n : null;
  }
  return out;
}
