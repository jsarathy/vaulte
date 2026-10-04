// src/components/PolarHRSparkline.jsx — a Polar session's heart-rate line, range and time in
// zones (in the "log a Polar session" box). Render only; figures from lib/polarHeartRate.
import { C, FONT } from "../constants/design.jsx";
import { CHART, heartRateChart } from "../lib/polarHeartRate.js";

const { width: W, height: H, pad: PAD } = CHART;
const S = {
  title: {
    fontSize: "10px",
    color: C.hint,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    marginBottom: "6px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  frame: {
    background: C.bg,
    borderRadius: "6px",
    border: `0.5px solid ${C.border}`,
    padding: "6px 8px",
  },
  bar: {
    display: "flex",
    height: "6px",
    borderRadius: "3px",
    overflow: "hidden",
    marginTop: "4px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    fontSize: "9px",
    color: C.muted,
  },
  swatch: (color) => ({
    width: "7px",
    height: "7px",
    borderRadius: "1px",
    background: color,
    flexShrink: 0,
  }),
};
const LABEL = { fontSize: "8", fill: C.hint, fontFamily: "DM Mono, monospace" };

function Line({ session, chart }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "70px", display: "block" }}>
      {/* dashed line at the average */}
      {session.hr_avg && (
        <line
          x1={PAD}
          y1={chart.avgY}
          x2={W - PAD}
          y2={chart.avgY}
          stroke={C.blueMid}
          strokeWidth="0.5"
          strokeDasharray="3,3"
        />
      )}
      <polyline
        points={chart.points}
        fill="none"
        stroke={C.blue}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <text x={PAD + 2} y={PAD + 8} {...LABEL}>
        {Math.round(chart.max)} bpm
      </text>
      <text x={PAD + 2} y={H - PAD - 2} {...LABEL}>
        {Math.round(chart.min)} bpm
      </text>
    </svg>
  );
}

function Zones({ chart }) {
  return (
    <>
      <div style={S.bar}>
        {chart.zones.map((z, i) => (
          <div
            key={i}
            style={{
              flex: z.secs / chart.totalSecs,
              background: z.color,
              minWidth: z.secs > 0 ? "1px" : "0",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "5px" }}>
        {chart.zones.map(
          (z, i) =>
            z.secs > 0 && (
              <div key={i} style={S.legendItem}>
                <div style={S.swatch(z.color)} />
                <span>
                  {z.label} {Math.round(z.secs / 60)}m
                </span>
              </div>
            ),
        )}
      </div>
    </>
  );
}

export default function PolarHRSparkline({ session }) {
  const chart = heartRateChart(session);
  if (!chart) return null;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={S.title}>
        <span>Heart rate · {chart.minutes} min recorded</span>
        <span style={{ fontFamily: FONT.mono }}>
          {chart.low}–{chart.high} bpm
        </span>
      </div>
      <div style={S.frame}>
        <Line session={session} chart={chart} />
        <Zones chart={chart} />
      </div>
    </div>
  );
}
