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

/** Form key of a field's actual value (targets use the plain key). */
export const actualKey = (key) => `actual_${key}`;
export const EMPTY_TARGETS = Object.fromEntries(
  TARGET_FIELDS.flatMap((f) => [
    [f.key, ""],
    [actualKey(f.key), ""],
  ]),
);

export const monthKeyOf = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;

export const monthLabelOf = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** Firestore doc → form values ("" for anything not set). */
export const fromTargetDoc = (data) =>
  Object.fromEntries(
    TARGET_FIELDS.flatMap((f) => [
      [f.key, data[f.key] ?? ""],
      [actualKey(f.key), data.actuals?.[f.key] ?? ""],
    ]),
  );

const numberOrNull = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Form values → Firestore doc: numbers, or null when blank; tolerances and actuals alongside. */
export function toTargetDoc(monthKey, vals) {
  const out = { month: monthKey, tolerance: TOLERANCE, updated_at: new Date().toISOString() };
  out.actuals = {};
  for (const f of TARGET_FIELDS) {
    out[f.key] = numberOrNull(vals[f.key]);
    out.actuals[f.key] = numberOrNull(vals[actualKey(f.key)]);
  }
  return out;
}

/**
 * "ok" / "off" / "" for one field. Weight and waist: the actual is within the tolerance of the
 * target. Sessions and sleep: the actual has reached the target. "" while either is blank.
 */
export function actualStatus(key, target, actual) {
  const t = numberOrNull(target);
  const a = numberOrNull(actual);
  if (t === null || a === null) return "";
  const tol = TOLERANCE[key];
  const ok = tol === undefined ? a >= t : Math.abs(a - t) <= tol + 1e-9;
  return ok ? "ok" : "off";
}
