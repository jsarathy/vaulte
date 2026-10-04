// src/lib/polarHeartRate.js — a Polar session's heart-rate line and time in zones.

export const CHART = { width: 368, height: 80, pad: 4 };
export const ZONES = [
  { label: "Z1", color: "#B5D4F4" }, // < 60% of max HR
  { label: "Z2", color: "#C0DD97" }, // 60–70%
  { label: "Z3", color: "#FAC775" }, // 70–80%
  { label: "Z4", color: "#F0997B" }, // 80–90%
  { label: "Z5", color: "#E24B4A" }, // ≥ 90%
];

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

// At most ~200 points are drawn; gaps (null) are skipped
function linePoints(samples, scale) {
  const step = Math.max(1, Math.floor(samples.length / 200));
  const xOf = (i) => CHART.pad + (i / (samples.length - 1)) * (CHART.width - CHART.pad * 2);
  const points = [];
  for (let i = 0; i < samples.length; i += step) {
    if (samples[i] != null)
      points.push(`${xOf(i).toFixed(1)},${yOf(samples[i], scale).toFixed(1)}`);
  }
  return points.join(" ");
}

const zoneOf = (pct) => [0.6, 0.7, 0.8, 0.9].filter((limit) => pct >= limit).length;

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
  const secs = zoneSeconds(samples, s.hr_max || 180, rate);
  return {
    ...scale,
    minutes: ((samples.length * rate) / 60) | 0,
    points: linePoints(samples, scale),
    avgY: s.hr_avg ? yOf(s.hr_avg, scale) : null,
    zones: ZONES.map((z, i) => ({ ...z, secs: secs[i] })),
    totalSecs: secs.reduce((a, b) => a + b, 0) || 1,
  };
}
