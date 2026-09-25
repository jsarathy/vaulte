// src/constants/weightPlan.js

const DAY = 86400000;
const noon = (dateStr) => Date.parse(`${String(dateStr).slice(0, 10)}T12:00:00`);
const iso = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const DEFAULT_PLAN_CONFIG = {
  // Personal
  age: 60, sex: "m", heightCm: 165, startWeightKg: 83.75, startDate: "2026-08-16",
  targetWeightMinKg: 70, targetWeightMaxKg: 72, vo2max: 33,

  // AM session
  amDurationMin: 20, amHRMin: 128, amHRMax: 140, amKcalMin: 180, amKcalMax: 200,
  // PM session
  pmDurationMin: 30, pmHRMin: 100, pmHRMax: 110, pmKcalMin: 150, pmKcalMax: 180,
  // Nutrition
  dailyCaloriesKcal: 1800, proteinMinG: 80, proteinMaxG: 100, activeDaysPerWeek: 5.5,

  // ── Projection curve ──────────────────────────────────────────────
  // Week 0 is implicit: startWeightKg on startDate. Anchors below are
  // week offsets from startDate; the curve interpolates linearly in time
  // between consecutive anchors and stops after the last one.
  planAnchors: [
    { week: 4,  weightKg: 78.4 },
    { week: 8,  weightKg: 74.5 },
    { week: 12, weightKg: 71.7 },
    { week: 16, weightKg: 69.7 },
    { week: 20, weightKg: 68.2 },
    { week: 24, weightKg: 67.1 },
    { week: 28, weightKg: 66.3 },
    { week: 32, weightKg: 65.8 },
    { week: 36, weightKg: 65.3 },
    { week: 40, weightKg: 65.0 },
  ],
  // Waist is derived from projected weight: cm lost per kg lost, taken as
  // linear in current projected weight between the first and last anchor.
  startWaistCm: 110.0,
  cmPerKgStart: 1.35,   // rate at the starting weight
  cmPerKgEnd: 0.86,     // rate at the final anchor weight

  // Cumulative-loss baseline (all-time high), independent of plan start.
  cumLossBaselineKg: 86.45,

  // Legacy / other
  maintenanceCaloriesKcal: 2136,
  phase1Weeks: 24, resetWeeks: 2, weeklyLossKg: 0.55,
  lever1PmMin: 40, lever2CaloriesKcal: 1675,
};

// ── Curve primitives ────────────────────────────────────────────────

/** Sorted anchor points, week 0 prepended from startWeightKg / startDate. */
export const planAnchorPoints = (cfg) => {
  const t0 = noon(cfg?.startDate);
  const w0 = Number(cfg?.startWeightKg);
  if (!Number.isFinite(t0) || !Number.isFinite(w0)) return [];
  const pts = [{ week: 0, weightKg: w0, t: t0 }];
  (Array.isArray(cfg.planAnchors) ? cfg.planAnchors : []).forEach((a) => {
    const wk = Number(a?.week), kg = Number(a?.weightKg);
    if (!Number.isFinite(wk) || !Number.isFinite(kg) || wk <= 0) return;
    pts.push({ week: wk, weightKg: kg, t: t0 + wk * 7 * DAY });
  });
  const seen = new Set();
  return pts
    .sort((a, b) => a.week - b.week)
    .filter((p) => (seen.has(p.week) ? false : (seen.add(p.week), true)));
};

/** Projected weight for any date inside the curve; null outside it. */
export const projectedWeightAt = (cfg, dateStr) => {
  const pts = planAnchorPoints(cfg);
  if (pts.length < 2) return null;
  const t = noon(dateStr);
  if (!Number.isFinite(t) || t < pts[0].t || t > pts[pts.length - 1].t) return null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (t <= b.t) {
      const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return +(a.weightKg + f * (b.weightKg - a.weightKg)).toFixed(2);
    }
  }
  return null;
};

/** cm of waist per kg of weight, as a function of current projected weight. */
export const cmPerKgAt = (cfg, weightKg) => {
  const pts = planAnchorPoints(cfg);
  const r0 = Number(cfg?.cmPerKgStart), r1 = Number(cfg?.cmPerKgEnd);
  if (pts.length < 2 || !Number.isFinite(r0) || !Number.isFinite(r1) || !Number.isFinite(weightKg)) return null;
  const wS = pts[0].weightKg, wE = pts[pts.length - 1].weightKg;
  if (wS === wE) return r1;
  return r1 + (r0 - r1) * ((weightKg - wE) / (wS - wE));
};

/**
 * Waist at a given weight: startWaistCm minus the integral of the rate over
 * the kg lost so far. The rate is linear in weight, so the integral is just
 * kg-lost x mean of the endpoint rates.
 */
export const waistForWeight = (cfg, weightKg) => {
  const pts = planAnchorPoints(cfg);
  const wStartCm = Number(cfg?.startWaistCm);
  if (pts.length < 2 || !Number.isFinite(wStartCm) || !Number.isFinite(weightKg)) return null;
  const wS = pts[0].weightKg;
  const rHere = cmPerKgAt(cfg, weightKg), rStart = cmPerKgAt(cfg, wS);
  if (rHere == null || rStart == null) return null;
  return +(wStartCm - (wS - weightKg) * ((rHere + rStart) / 2)).toFixed(1);
};

/** Projected waist for any date inside the curve; null outside it. */
export const projectedWaistAt = (cfg, dateStr) => {
  const w = projectedWeightAt(cfg, dateStr);
  return w == null ? null : waistForWeight(cfg, w);
};

/** Weekly series from week 0 to the last anchor. Nothing beyond it. */
export const buildProjectionSeries = (cfg) => {
  const pts = planAnchorPoints(cfg);
  if (pts.length < 2) return [];
  const t0 = pts[0].t, lastWeek = pts[pts.length - 1].week;
  const out = [];
  for (let w = 0; w <= lastWeek; w++) {
    const t = t0 + w * 7 * DAY;
    const date = iso(t);
    const kg = projectedWeightAt(cfg, date);
    if (kg == null) continue;
    out.push({ week: w, t, date, projected: kg, waist: waistForWeight(cfg, kg) });
  }
  return out;
};

// ── Milestones ──────────────────────────────────────────────────────

export function deriveMilestones(cfg) {
  const s = buildProjectionSeries(cfg);
  if (!s.length) return [];
  const fmt = (t) => new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const w = () => ""; // waist moved to the Body tab; milestone notes are weight-only
  const start = s[0], end = s[s.length - 1];
  const first = (pred) => s.find(pred) || null;

  const m4 = first((r) => r.projected <= start.projected - 4);
  const m8 = first((r) => r.projected <= start.projected - 8);
  const tgt = Number.isFinite(cfg?.targetWeightMaxKg)
    ? first((r) => r.projected <= cfg.targetWeightMaxKg)
    : null;

  return [
    { date: fmt(start.t), weight: `${start.projected.toFixed(1)} kg`,
      note: `START${w(start)}`, phase: "Phase 1" },
    m4 && { date: fmt(m4.t), weight: `${m4.projected.toFixed(1)} kg`,
      note: `-4 kg${w(m4)}`, phase: "Phase 1" },
    m8 && { date: fmt(m8.t), weight: `${m8.projected.toFixed(1)} kg`,
      note: `-8 kg${w(m8)}`, phase: "Phase 1" },
    tgt && tgt !== end && { date: fmt(tgt.t), weight: `${tgt.projected.toFixed(1)} kg`,
      note: `TARGET ZONE${w(tgt)}`, phase: "Phase 3" },
    { date: fmt(end.t), weight: `${end.projected.toFixed(1)} kg`,
      note: `Plan end, wk ${end.week}${w(end)}`, phase: "Phase 3" },
  ].filter(Boolean);
}

// ── Deprecated ──────────────────────────────────────────────────────
// Retained only so the legacy WeightTab.jsx still builds. Not used by
// WeightTracker.jsx; delete once WeightTab.jsx is removed.
export function generateWeightProjection(cfg) {
  return buildProjectionSeries(cfg).map((r) => ({
    week: r.week,
    date: new Date(r.t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    projected: r.projected,
    waist: r.waist,
    phase: "Phase 1 — Active",
  }));
}
