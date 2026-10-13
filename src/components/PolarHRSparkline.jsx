// src/components/PolarHRSparkline.jsx — a Polar session's heart-rate line, range and time in
// zones (in the "log a Polar session" box); `large` is the version for the expanded box. Render
// only; figures from lib/polarHeartRate.
import { C, FONT } from "../constants/design.jsx";
import { CHART, heartRateChart } from "../lib/polarHeartRate.js";

const { width: W, height: H, pad: PAD, left: LEFT } = CHART;
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
// The larger variant: the line as wide as the box (it keeps its shape), bigger type and zones.
const L = {
  title: { fontSize: "16px" },
  range: { fontSize: "20px" },
  svg: { width: "100%", height: "auto", maxHeight: "60vh", display: "block" },
  bar: { height: "14px", borderRadius: "7px", marginTop: "14px" },
  legend: { gap: "14px", marginTop: "10px", flexWrap: "wrap" },
  item: { fontSize: "16px", gap: "6px" },
};
const big = (large, base, extra) => (large ? { ...base, ...extra } : base);
const LABEL = { fontSize: "8", fill: C.hint, fontFamily: "DM Mono, monospace" };
const AXIS_LABEL = { ...LABEL, textAnchor: "end" };

const SMALL_SVG = { width: "100%", height: "70px", display: "block" };

/** The y-axis: a faint line and a bpm label at each tick; the highest label carries the unit. */
function Axis({ ticks }) {
  return ticks.map((t, i) => (
    <g key={t.bpm}>
      <line x1={LEFT} y1={t.y} x2={W - PAD} y2={t.y} stroke={C.border} strokeWidth="0.4" />
      <text x={LEFT - 3} y={t.y + 2.5} {...AXIS_LABEL}>
        {i === ticks.length - 1 ? `${t.bpm} bpm` : t.bpm}
      </text>
    </g>
  ));
}

function Line({ session, chart, large }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={big(large, SMALL_SVG, L.svg)}>
      <Axis ticks={chart.ticks} />
      {/* dashed line at the average */}
      {session.hr_avg && (
        <line
          x1={LEFT}
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
    </svg>
  );
}

function Zones({ chart, large }) {
  return (
    <>
      <div style={big(large, S.bar, L.bar)}>
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
      <div style={big(large, { display: "flex", gap: "8px", marginTop: "5px" }, L.legend)}>
        {chart.zones.map(
          (z, i) =>
            z.secs > 0 && (
              <div key={i} style={big(large, S.legendItem, L.item)}>
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

export default function PolarHRSparkline({ session, large = false }) {
  const chart = heartRateChart(session);
  if (!chart) return null;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={big(large, S.title, L.title)}>
        <span>Heart rate · {chart.minutes} min recorded</span>
        <span style={big(large, { fontFamily: FONT.mono }, L.range)}>
          {chart.low}–{chart.high} bpm
        </span>
      </div>
      <div style={S.frame}>
        <Line session={session} chart={chart} large={large} />
        <Zones chart={chart} large={large} />
      </div>
    </div>
  );
}
