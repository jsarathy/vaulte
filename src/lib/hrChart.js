// src/lib/hrChart.js — the Polar session box's heart-rate chart: the line (at most ~300 points;
// gaps skipped), its scale (5 bpm of room each side), the average line, and time in each zone by
// % of max HR (185 when Polar gave none).

export const HR_CHART = { width: 420, height: 90, pad: 4 };
export const HR_ZONES = [
  { label: "Z1 Easy", color: "#B5D4F4" }, // < 60% of max HR
  { label: "Z2 Fat burn", color: "#C0DD97" }, // 60–70%
  { label: "Z3 Aerobic", color: "#FAC775" }, // 70–80%
  { label: "Z4 Threshold", color: "#F0997B" }, // 80–90%
  { label: "Z5 Max", color: "#E24B4A" }, // ≥ 90%
];
const { width: W, height: H, pad: PAD } = HR_CHART;

/** y of a heart rate on the scale. */
const yOf = (hr, scale) => PAD + (1 - (hr - scale.min) / (scale.max - scale.min)) * (H - PAD * 2);

function linePoints(samples, scale) {
  const step = Math.max(1, Math.floor(samples.length / 300));
  const points = [];
  for (let i = 0; i < samples.length; i += step) {
    const x = PAD + (i / (samples.length - 1)) * (W - PAD * 2);
    if (samples[i] != null) points.push(`${x.toFixed(1)},${yOf(samples[i], scale).toFixed(1)}`);
  }
  return points.join(" ");
}

const zoneOf = (pct) => [0.6, 0.7, 0.8, 0.9].filter((limit) => pct >= limit).length;

function zoneSeconds(samples, hrMax, rate) {
  const secs = [0, 0, 0, 0, 0];
  for (const v of samples) if (v != null) secs[zoneOf(v / hrMax)] += rate;
  return secs;
}

/** Everything the chart draws; null with fewer than two samples or two real readings. */
export function hrChart(s) {
  const samples = s?.hr_samples || [];
  const valid = samples.filter((v) => v != null);
  if (valid.length < 2) return null;
  const low = Math.min(...valid);
  const high = Math.max(...valid);
  const scale = { min: low - 5, max: high + 5 };
  const rate = s.recording_rate_s || 5;
  const secs = zoneSeconds(samples, s.hr_max || 185, rate);
  return {
    low,
    high,
    scale,
    minutes: Math.round((samples.length * rate) / 60),
    points: linePoints(samples, scale),
    avgY: s.hr_avg ? yOf(s.hr_avg, scale) : null,
    zones: HR_ZONES.map((z, i) => ({ ...z, secs: secs[i] })),
    totalSecs: secs.reduce((a, b) => a + b, 0), // 2+ readings: never 0
  };
}
