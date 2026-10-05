// src/lib/trajectoryChart.js — what the Weight and Body tabs' Trajectory charts draw: the chosen
// metric's readings (for weight, also the plan curve and the 2-wk average), and the drawing's scales,
// gridlines, date labels, paths and hover label. Compact: a fixed 380 × 230 drawing scaled to the
// panel. Expanded: real pixels, at least MIN_DAY_PX per day, scrolling sideways, so daily
// readings always get room to separate.
import { buildProjectionSeries } from "../constants/weightPlan.js";
import { metricUnit } from "./weightMetrics.js";
import { twoWeekAvgAt, weightReadings } from "./twoWeekWeight.js";

const DAY = 86400000;
const MIN_DAY_PX = 12;
const COMPACT = { W: 380, H: 230 };
const Y_STEPS = [1, 2, 2.5, 5, 10];
const X_STEP_DAYS = [1, 2, 3, 7, 14, 30, 61, 91, 182, 365];

/** Readings, oldest first: { t, v, date } for each dated row valOf finds a value in. */
function readingsOf(rows, valOf) {
  return rows
    .filter((row) => valOf(row) != null && Number.isFinite(Date.parse(row.date)))
    .map((row) => ({ t: Date.parse(row.date), v: Number(valOf(row)), date: row.date }))
    .sort((a, b) => a.t - b.t);
}

/** The plan curve as { t, v } points. */
const planPoints = (cfg) =>
  buildProjectionSeries(cfg)
    .filter((p) => p.projected != null)
    .map((p) => ({ t: p.t, v: p.projected }));

/** Everything plotted for a metric. Only weight has a plan curve and a 2-wk average. */
export function chartSeries(weightLog, metric, cfg) {
  const acts = readingsOf(weightLog, (row) =>
    metric === "weight" ? row.actual : row.renpho?.[metric],
  );
  if (metric !== "weight")
    return { isPlan: false, unit: metricUnit(metric), acts, avgPts: [], projPts: [] };
  const readings = weightReadings(weightLog);
  const avgPts = acts
    .map((a) => ({ t: a.t, v: twoWeekAvgAt(readings, a.date) }))
    .filter((p) => p.v != null);
  return { isPlan: true, unit: "kg", acts, avgPts, projPts: planPoints(cfg) };
}

/** A Body tab site's tape readings (cm). Its scale keeps at least 0.5 cm above and below. */
export const bodySeries = (bodyLog, site) => ({
  isPlan: false,
  unit: "cm",
  acts: readingsOf(bodyLog, (row) => row[site]),
  avgPts: [],
  projPts: [],
  minPad: 0.5,
});

/** Drawable once there are two points of either the plan curve or the readings. */
export const hasEnough = ({ projPts, acts }) => projPts.length >= 2 || acts.length >= 2;

function timeSpan({ projPts, acts }) {
  const ts = [...projPts.map((p) => p.t), ...acts.map((a) => a.t)];
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const span = tMax - tMin || 1;
  return { tMin, tMax, span, days: Math.max(1, span / DAY) };
}

const padding = (k) => ({ top: 12 * k, right: 16 * k, bottom: 50 * k, left: 40 * k }); // bottom: 45° dates

/** Drawing size. Expanded: the measured area (else the window), wide enough for every day. */
function canvas(full, days, box) {
  if (!full) return { k: 1, PAD: padding(1), ...COMPACT };
  const PAD = padding(1.6);
  const vw = box.w || (typeof window !== "undefined" ? window.innerWidth - 48 : 1200);
  const vh = box.h || (typeof window !== "undefined" ? window.innerHeight - 150 : 600);
  const W = Math.max(vw, PAD.left + PAD.right + days * MIN_DAY_PX);
  return { k: 1.6, PAD, W, H: Math.max(300, vh - 22) }; // 22px leaves room for the scrollbar
}

/** Room above and below the values: 1 kg for weight, else 15% of the range, at least minPad
 * (default 1% of the top value, at least 0.1). */
function valuePad({ isPlan, minPad }, vals) {
  if (isPlan) return 1;
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  return Math.max((hi - lo) * 0.15, minPad ?? Math.max(Math.abs(hi) * 0.01, 0.1));
}

/** Value scale; for weight, low enough to show the target zone's bottom too. */
function valueRange(series, cfg) {
  const { isPlan, projPts, acts } = series;
  const vals = [...projPts.map((p) => p.v), ...acts.map((a) => a.v)];
  const vPad = valuePad(series, vals);
  const maxW = Math.max(...vals) + vPad;
  const minW = Math.min(...vals) - vPad;
  if (!isPlan || !Number.isFinite(cfg.targetWeightMinKg)) return { minW, maxW };
  return { minW: Math.min(minW, cfg.targetWeightMinKg - 1), maxW };
}

/** Dot size follows the gap between consecutive days, so dots shrink rather than overlap. */
function dots(k, dayPx) {
  const r = Math.min(3 * k, Math.max(0.6, dayPx * 0.4));
  return { r, actSW: Math.min(2.5 * k, Math.max(0.6, r * 0.7)) };
}

/** Sizes, scales and x / y mappers for the drawing. view: { full, box: { w, h } }. */
export function chartLayout(series, cfg, view) {
  const time = timeSpan(series);
  const { k, PAD, W, H } = canvas(view.full, time.days, view.box);
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const { minW, maxW } = valueRange(series, cfg);
  const dayPx = cW / time.days;
  const xS = (t) => PAD.left + ((t - time.tMin) / time.span) * cW;
  const yS = (v) => PAD.top + cH - ((v - minW) / (maxW - minW)) * cH;
  const sizes = { k, PAD, W, H, cW, cH, fs: 8 * k, sw: 1.5 * k, dayPx, ...dots(k, dayPx) };
  return { ...time, ...sizes, minW, maxW, xS, yS, full: view.full };
}

/** Enough decimals to show the step exactly (2.5 → 1, 0.25 → 2), so labels never collide. */
function decimalsFor(step) {
  let dec = 0;
  while (dec < 6 && Math.abs(step * 10 ** dec - Math.round(step * 10 ** dec)) > 1e-6) dec++;
  return dec;
}

/** "Nice" y gridlines, ~6 (compact) or ~10 (expanded) whatever the scale (kg, %, kcal…). */
export function yAxis({ minW, maxW, full }) {
  const rawStep = (maxW - minW) / (full ? 10 : 6);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Y_STEPS.map((m) => m * mag).find((s) => s >= rawStep);
  const dec = decimalsFor(step);
  const ticks = [];
  for (let w = Math.ceil(minW / step) * step; w <= maxW + 1e-9; w += step)
    ticks.push(+w.toFixed(dec + 1));
  return { ticks, dec };
}

/** Date ticks: the finest step whose labels still have room, so wider charts show more dates. */
export function xTicks({ tMin, tMax, dayPx, fs }) {
  const step = X_STEP_DAYS.find((d) => d * dayPx >= fs * 2.2) || 365;
  const ticks = [];
  for (let t = Math.ceil(tMin / DAY) * DAY; t <= tMax; t += step * DAY) ticks.push(t);
  return ticks;
}

/** dd/mm/yyyy (UTC). */
export const dateLabel = (t) =>
  new Date(t).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

/** SVG path through { t, v } points ("" when there are none). */
export const linePath = (points, { xS, yS }) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xS(p.t).toFixed(1)},${yS(p.v).toFixed(1)}`)
    .join(" ");

/** y of the target zone's top and bottom (weight only); null where there's no target. */
export function targetZone(cfg, isPlan, { yS }) {
  const yOf = (kg) => (isPlan && Number.isFinite(kg) ? yS(kg) : null);
  return { hi: yOf(cfg.targetWeightMaxKg), lo: yOf(cfg.targetWeightMinKg) };
}

/** x of the latest reading (the expanded view scrolls to it); null with no readings. */
export const latestX = ({ acts }, { xS }) => (acts.length ? xS(acts[acts.length - 1].t) : null);

/** Scroll position that puts x three quarters of the way across. */
export const scrollLeftFor = (x, width) => Math.max(0, x - width * 0.75);

/** Hover target around a reading: a day wide, at least twice the dot. */
export const hitRadius = ({ r, dayPx }) => Math.max(r * 2, Math.min(dayPx / 2, 14));

/** Hover label text: date · value unit [· 2-wk avg]. */
export function hoverLabel(point, { unit, avgPts }) {
  const avg = avgPts.find((p) => p.t === point.t);
  const value = `${Number(point.v).toFixed(1)}${unit ? ` ${unit}` : ""}`;
  return `${dateLabel(point.t)} · ${value}${avg ? ` · 2-wk avg ${avg.v.toFixed(1)}` : ""}`;
}

/** Hover label box: centred over the point, kept inside the chart, below it when no room above. */
export function hoverBox(point, label, L) {
  const bw = label.length * L.fs * 0.58 + 16;
  const bh = L.fs * 2;
  const px = L.xS(point.t);
  const py = L.yS(point.v);
  const bx = Math.min(Math.max(px - bw / 2, L.PAD.left), L.PAD.left + L.cW - bw);
  const above = py - bh - 12 >= L.PAD.top;
  return { bx, by: above ? py - bh - 12 : py + 12, bw, bh };
}
