// src/lib/polarHeartRate.js — a Polar session's heart-rate line, its y-axis, time in zones and the
// zones table.

// `left` is the gutter for the y-axis labels; the line starts after it.
export const CHART = { width: 368, height: 80, pad: 4, left: 40 };
export const ZONES = [
  { label: "Z1", color: "#B5D4F4" }, // < 60% of max HR
  { label: "Z2", color: "#C0DD97" }, // 60–70%
  { label: "Z3", color: "#FAC775" }, // 70–80%
  { label: "Z4", color: "#F0997B" }, // 80–90%
  { label: "Z5", color: "#E24B4A" }, // ≥ 90%
];

/** What each zone means, in plain words (the same order as ZONES). */
export const ZONE_INFO = [
  { name: "Easy", meaning: "Warm-up and recovery; light effort you could keep up for hours." },
  {
    name: "Fat burn",
    meaning: "Steady endurance; builds your base, with a high share of fat as fuel.",
  },
  {
    name: "Aerobic",
    meaning: "Improves aerobic fitness; moderate effort, you can still talk in short sentences.",
  },
  { name: "Threshold", meaning: "Hard; raises speed and stamina, but only for a while." },
  { name: "Max", meaning: "Very hard, all-out; short bursts only." },
];
const LIMITS = [0.6, 0.7, 0.8, 0.9]; // the zone boundaries, as a share of max HR
const DEFAULT_MAX_HR = 180;

/** The max HR the zones are shares of: Polar's highest reading for the session, else 180. */
export const maxHrOf = (s) => s.hr_max || DEFAULT_MAX_HR;

/** Lowest / highest reading, and the chart's scale (5 bpm of room each side). */
function scaleOf(samples) {
  const valid = samples.filter((v) => v != null);
  const low = Math.min(...valid);
  const high = Math.max(...valid);
  return { low, high, min: low - 5, max: high + 5 };
}

/** y for a heart rate: higher rates nearer the top. */
const yOf = (hr, scale) =>
  CHART.pad + (1 - (hr - scale.min) / (scale.max - scale.min)) * (CHART.height - CHART.pad * 2);

const STEPS = [5, 10, 20, 25, 50];
const MAX_TICKS = 5;

/** The y-axis: the smallest step of 5, 10, 20, 25 or 50 bpm that gives at
 *  most five steps across the scale (the largest, 50, if none does); a tick sits on every multiple
 *  of it inside the scale, the ends included; { bpm, y } each, lowest first. */
export function axisTicks(scale) {
  const step = STEPS.find((s) => (scale.max - scale.min) / s <= MAX_TICKS) || STEPS.at(-1);
  const ticks = [];
  for (let bpm = Math.ceil(scale.min / step) * step; bpm <= scale.max; bpm += step) {
    ticks.push({ bpm, y: yOf(bpm, scale) });
  }
  return ticks;
}

// At most ~200 points are drawn, after the axis gutter; gaps (null) are skipped
function linePoints(samples, scale) {
  const step = Math.max(1, Math.floor(samples.length / 200));
  const span = CHART.width - CHART.left - CHART.pad;
  const xOf = (i) => CHART.left + (i / (samples.length - 1)) * span;
  const points = [];
  for (let i = 0; i < samples.length; i += step) {
    if (samples[i] != null)
      points.push(`${xOf(i).toFixed(1)},${yOf(samples[i], scale).toFixed(1)}`);
  }
  return points.join(" ");
}

const zoneOf = (pct) => [0.6, 0.7, 0.8, 0.9].filter((limit) => pct >= limit).length;

/** The zones as table rows for a max HR: { label, name, color, range, meaning }. A zone starts at
 *  its limit's share of the max (rounded up to a whole bpm) and ends just before the next. */
export function zoneTable(maxHr) {
  const start = (i) => Math.ceil(LIMITS[i] * maxHr - 1e-9);
  const range = (i) => {
    if (i === 0) return `under ${start(0)}`;
    if (i === LIMITS.length) return `${start(i - 1)}+`;
    return `${start(i - 1)}–${start(i) - 1}`;
  };
  return ZONES.map((z, i) => ({ ...z, ...ZONE_INFO[i], range: range(i), color: z.color }));
}

/** Seconds in each zone, by % of max HR (180 when Polar gave none). */
function zoneSeconds(samples, hrMax, rate) {
  const secs = [0, 0, 0, 0, 0];
  for (const v of samples) if (v != null) secs[zoneOf(v / hrMax)] += rate;
  return secs;
}

/** Everything the chart draws, or null with fewer than 2 samples. */
export function heartRateChart(s) {
  const samples = s.hr_samples;
  if (!samples || samples.length < 2) return null;
  const scale = scaleOf(samples);
  const rate = s.recording_rate_s || 5;
  const maxHr = maxHrOf(s);
  const secs = zoneSeconds(samples, maxHr, rate);
  return {
    ...scale,
    maxHr,
    ticks: axisTicks(scale),
    minutes: ((samples.length * rate) / 60) | 0,
    points: linePoints(samples, scale),
    avgY: s.hr_avg ? yOf(s.hr_avg, scale) : null,
    zones: ZONES.map((z, i) => ({ ...z, secs: secs[i] })),
    totalSecs: secs.reduce((a, b) => a + b, 0) || 1,
  };
}
