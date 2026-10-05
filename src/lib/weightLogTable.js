// src/lib/weightLogTable.js — the Weight tab's log table: each row's figures (vs Proj, Cum Loss,
// 2-wk Loss), which rows are past / current, the sync cutoff and purge wording, and row edits.
import { projectedWeightAt } from "../constants/weightPlan.js";
import { twoWeekLossAt, weightReadings } from "./twoWeekWeight.js";

const DEFAULT_CUM_LOSS_BASELINE_KG = 86.45;

/** Cum Loss is measured from this weight (the all-time high), or 86.45 kg when unset/unreadable. */
export function cumLossBaseline(cfg) {
  const kg = Number(cfg.cumLossBaselineKg);
  return Number.isFinite(kg) ? kg : DEFAULT_CUM_LOSS_BASELINE_KG;
}

/** Sync cutoff: measurements before it are rejected by the sync and can be purged. */
export const syncFromOf = (cfg) => cfg.syncFromDate || cfg.startDate || null;

/** Rows dated before the cutoff (0 without one). */
export const staleCount = (weightLog, syncFrom) =>
  weightLog.filter((row) => row.date && syncFrom && row.date < syncFrom).length;

export const purgePrompt = (count, syncFrom) =>
  `Delete ${count} record${count !== 1 ? "s" : ""} dated before ${syncFrom}? This cannot be undone.`;

const toneOf = (x) => (x > 0 ? "up" : x < 0 ? "down" : "flat");

/** Reading minus projection ("1.2"): the row's saved projection, else the plan's; null without. */
function vsProjection(row, cfg) {
  const planned = projectedWeightAt(cfg, row.date);
  const projected = row.projected != null ? row.projected : planned;
  if (row.actual == null || projected == null) return null;
  return (row.actual - projected).toFixed(1);
}

/** vs Proj as shown: "+1.2" (over), "-0.4" (under), "0.0"; tone null when there's no figure. */
export function vsProjFigure(diff) {
  if (diff == null) return { text: "—", tone: null };
  const x = parseFloat(diff);
  return { text: `${x > 0 ? "+" : ""}${diff}`, tone: toneOf(x) };
}

/** 2-wk Loss as shown: a loss as "-0.8 kg" (tone up), a gain as "+0.5 kg" (tone down). */
export function twoWeekFigure(loss) {
  if (loss == null) return { text: "—", tone: null };
  const x = parseFloat(loss);
  return { text: x >= 0 ? `-${loss} kg` : `+${Math.abs(x).toFixed(1)} kg`, tone: toneOf(x) };
}

/** Cum Loss as shown ("-2.3 kg"); null without a reading. */
export const cumLossFigure = (row, baseline) =>
  row.actual != null ? `-${(baseline - row.actual).toFixed(1)} kg` : null;

/** Dated today or earlier (a missing or unreadable date never is). */
const isPast = (date, now) => new Date(date) <= now;

/** A reading with no reading after it (the latest of a run). */
const isCurrent = (weightLog, i) => weightLog[i].actual != null && weightLog[i + 1]?.actual == null;

function rowView(weightLog, i, context) {
  const row = weightLog[i];
  return {
    row,
    index: i, // index into weightLog, for edits
    key: row.date || i,
    vsProj: vsProjFigure(vsProjection(row, context.cfg)),
    cumLoss: cumLossFigure(row, context.baseline),
    twoWeek: twoWeekFigure(twoWeekLossAt(context.readings, row)),
    past: isPast(row.date, context.now),
    current: isCurrent(weightLog, i),
    odd: i % 2 === 1,
  };
}

/** The table's rows, latest first. */
export function tableRows(weightLog, cfg, now) {
  const context = { cfg, now, baseline: cumLossBaseline(cfg), readings: weightReadings(weightLog) };
  return weightLog.map((_, i) => rowView(weightLog, i, context)).reverse();
}

/** The row with fields changed, or null for a row without a date (not saved). */
export function editedRow(weightLog, i, fields) {
  const row = weightLog[i];
  return row?.date ? { ...row, ...fields } : null;
}
