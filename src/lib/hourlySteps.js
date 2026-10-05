// src/lib/hourlySteps.js — the Steps-by-hour card's numbers: hour values from an apple_activity
// hourly map, totals and peak, labels, and the chart geometry (compact vs full screen).

// "Nice" whole-number step for the step-count axis (1, 2, 5 × 10^n), aiming for ~`target` gridlines.
export function niceAxis(max, target) {
  const top = Math.max(max, 1);
  const raw = top / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw),
  );
  const yMax = Math.ceil(top / step) * step;
  const ticks = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  return { yMax, ticks };
}

export const HOURS = Array.from({ length: 24 }, (_, h) => h);
const COMPACT_LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export const pad2 = (h) => String(h).padStart(2, "0");
export const hh = (h) => `${pad2(h)}:00`;

// 24 step counts from { "07": 1234, … }; anything missing or non-numeric counts as 0
export const hourValues = (hourly) => HOURS.map((h) => Number(hourly?.[pad2(h)]) || 0);

export function summarise(vals) {
  const total = vals.reduce((a, b) => a + b, 0);
  const peakVal = Math.max(...vals);
  return { total, peakVal, peak: vals.indexOf(peakVal) };
}

export const hoverLabel = (hover, vals) =>
  `${hh(hover)}–${hh((hover + 1) % 24)} · ${vals[hover].toLocaleString()} steps`;

export const fmtDate = (d) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

export const todayISO = () => new Date().toLocaleDateString("en-CA");

const viewport = (key, less, fallback) =>
  typeof window !== "undefined" ? window[key] - less : fallback;

// Compact = fixed drawing scaled to the panel; full = real pixels of the measured area (≥ 600×300).
export function frameSize(full, box) {
  if (!full) return { W: 300, H: 130 };
  return {
    W: Math.max(600, box.w || viewport("innerWidth", 48, 1200)),
    H: Math.max(300, (box.h || viewport("innerHeight", 140, 600)) - 4),
  };
}

// Scale factors, padding and the bar width for the frame
export function frame(full, box) {
  const k = full ? 1.6 : 1;
  const tk = full ? 1.5 : 1; // expanded view: all text 50% larger (Fix 8)
  const { W, H } = frameSize(full, box);
  const PAD = { l: 34 * k * tk, r: 8 * k, t: 10 * k * tk, b: 18 * k * tk };
  const cH = H - PAD.t - PAD.b;
  return { full, k, W, H, PAD, cH, bw: (W - PAD.l - PAD.r) / 24, fs: 8 * k * tk };
}

export function geometry({ full, box, peakVal }) {
  const g = frame(full, box);
  const { yMax, ticks } = niceAxis(peakVal, full ? 8 : 4);
  return {
    ...g,
    yMax,
    ticks,
    yS: (v) => g.PAD.t + g.cH - (v / yMax) * g.cH,
    xLabelHours: full ? HOURS : COMPACT_LABEL_HOURS,
  };
}
