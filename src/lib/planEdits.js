// src/lib/planEdits.js — editing the weight plan: number fields, the sync-from date shown, and the
// projection curve's anchors (edit, add four weeks on, remove) with their dates.

/** A typed number; blank or unreadable is 0. */
export const numberField = (text) => parseFloat(text) || 0;

/** The plan's anchors; anything that isn't a list counts as none. */
export const anchorsOf = (plan) => (Array.isArray(plan.planAnchors) ? plan.planAnchors : []);

/** Sync-from as shown in the editor: its own date, else the start date. */
export const syncFromValue = (plan) => plan.syncFromDate || plan.startDate || "";

export const withField = (plan, key, value) => ({ ...plan, [key]: value });

/** The plan with fields of anchor i changed. */
export function withAnchorFields(plan, i, fields) {
  const anchors = [...anchorsOf(plan)];
  anchors[i] = { ...anchors[i], ...fields };
  return { ...plan, planAnchors: anchors };
}

/** The plan with an anchor four weeks after the last, at its weight (else the start weight). */
export function withNewAnchor(plan) {
  const anchors = anchorsOf(plan);
  const last = anchors[anchors.length - 1];
  const anchor = {
    week: (Number(last?.week) || 0) + 4,
    weightKg: Number(last?.weightKg) || Number(plan.startWeightKg) || 0,
  };
  return { ...plan, planAnchors: [...anchors, anchor] };
}

export const withoutAnchor = (plan, i) => ({
  ...plan,
  planAnchors: anchorsOf(plan).filter((_, j) => j !== i),
});

const WEEK_MS = 7 * 86400000;

/** An anchor's date ("13 Sept 26"): the start date plus its weeks; "—" without both. */
export function anchorDate(startDate, week) {
  const t = Date.parse(`${String(startDate).slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(t) || !Number.isFinite(Number(week))) return "—";
  return new Date(t + Number(week) * WEEK_MS).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}
