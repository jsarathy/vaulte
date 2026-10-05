// src/lib/planSummary.js — the Plan Specifications card when not editing: Personal Stats and
// Projection Curve as label / value pairs, and the Milestone Roadmap with its phase badges.
import { buildProjectionSeries, deriveMilestones } from "../constants/weightPlan.js";
import { cumLossBaseline, syncFromOf } from "./weightLogTable.js";

/** BMI to 1 dp ("30.8"). */
export const bmiOf = (kg, heightCm) => (kg / Math.pow(heightCm / 100, 2)).toFixed(1);

/** VO₂ max band: under 35 Fair, under 45 Good, else Excellent. */
export const vo2Band = (vo2max) => (vo2max < 35 ? "Fair" : vo2max < 45 ? "Good" : "Excellent");

/** Personal Stats rows. */
export function personalStats(cfg) {
  const { targetWeightMinKg: lo, targetWeightMaxKg: hi } = cfg;
  return [
    ["Age", `${cfg.age} yr`],
    ["Sex", cfg.sex === "m" ? "Male" : "Female"],
    ["Height", `${cfg.heightCm} cm`],
    ["Start Weight", `${cfg.startWeightKg.toFixed(1)} kg`],
    ["Start BMI", bmiOf(cfg.startWeightKg, cfg.heightCm)],
    ["Target", `${lo}–${hi} kg`],
    ["Target BMI", `${bmiOf(lo, cfg.heightCm)}–${bmiOf(hi, cfg.heightCm)}`],
    ["VO₂ Max", `${cfg.vo2max} — ${vo2Band(cfg.vo2max)}`],
    ["Cum-loss base", `${cumLossBaseline(cfg).toFixed(2)} kg`],
  ];
}

/** Projection Curve rows; length and end weight need a curve. */
export function curveSummary(cfg) {
  const series = buildProjectionSeries(cfg);
  const end = series[series.length - 1]; // a curve has 2+ weeks or none
  return [
    ["Anchors", `${(cfg.planAnchors || []).length + 1} points`],
    ["Plan length", end ? `${end.week} weeks` : "—"],
    ["End weight", end ? `${end.projected.toFixed(1)} kg` : "—"],
    ["Maintenance", `${(cfg.maintenanceCaloriesKcal || 0).toLocaleString()} kcal`],
    ["Sync From", syncFromOf(cfg) || "—"],
  ];
}

/** Milestones for the roadmap; none if the plan can't be worked out. */
export function planMilestones(cfg) {
  try {
    return deriveMilestones(cfg) || [];
  } catch {
    return [];
  }
}

const BADGES = {
  "Phase 1": { label: "P1", background: "#E8F5E9", color: "#2E7D32" },
  "Phase 3": { label: "P3", background: "#E3F2FD", color: "#185FA5" },
  RESET: { label: "RST", background: "#FFF3CD", color: "#795548" },
};

/** A milestone's phase badge (anything unknown shows as RST in Phase 1 colours). */
export const phaseBadge = (phase) =>
  BADGES[phase] ?? { ...BADGES["Phase 1"], label: BADGES.RESET.label };
