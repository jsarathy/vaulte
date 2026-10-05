// src/components/HRChart.jsx — a Polar session's heart-rate line, range and time in zones (in the
// Daily log's Polar session box). Render only; figures from lib/hrChart.
import { C, FONT } from "../constants/design.jsx";
import { HR_CHART, hrChart } from "../lib/hrChart.js";

const { width: W, height: H, pad: PAD } = HR_CHART;
const LABEL = { fontSize: "8", fill: C.hint, fontFamily: "DM Mono,monospace" };
const S = {
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "6px",
  },
  title: {
    fontSize: "10px",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    color: C.hint,
  },
  range: { fontFamily: FONT.mono, fontSize: "11px", color: C.muted },
  frame: {
    background: C.bg,
    borderRadius: "6px",
    border: `0.5px solid ${C.border}`,
    padding: "8px 10px",
  },
  svg: { width: "100%", height: "80px", display: "block" },
  bar: {
    display: "flex",
    height: "6px",
    borderRadius: "3px",
    overflow: "hidden",
    marginTop: "6px",
  },
  legend: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" },
  item: { display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: C.muted },
  swatch: (color) => ({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    background: color,
    flexShrink: 0,
  }),
  minutes: { fontFamily: FONT.mono, color: C.text, fontWeight: "500" },
};

// The top and bottom labels read 5 bpm in from the scale's edges (sic: the top shows max + 10)
function Line({ chart, avg }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={S.svg}>
      {chart.avgY !== null && (
        <line
          x1={PAD}
          y1={chart.avgY}
          x2={W - PAD}
          y2={chart.avgY}
          stroke={C.blueMid}
          strokeWidth="0.8"
          strokeDasharray="4,3"
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
      <text x={PAD + 2} y={PAD + 9} {...LABEL}>
        {Math.round(chart.scale.max + 5)} bpm
      </text>
      <text x={PAD + 2} y={H - PAD - 2} {...LABEL}>
        {Math.round(chart.scale.min + 5)} bpm
      </text>
      {chart.avgY !== null && (
        <text x={W - PAD - 2} y={chart.avgY - 3} {...LABEL} fill={C.blue} textAnchor="end">
          avg {avg}
        </text>
      )}
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
              minWidth: z.secs > 0 ? "2px" : "0",
            }}
          />
        ))}
      </div>
      <div style={S.legend}>
        {chart.zones.map(
          (z, i) =>
            z.secs > 0 && (
              <div key={i} style={S.item}>
                <div style={S.swatch(z.color)} />
                <span>{z.label}</span>
                <span style={S.minutes}>{Math.round(z.secs / 60)}m</span>
              </div>
            ),
        )}
      </div>
    </>
  );
}

export default function HRChart({ session }) {
  const chart = hrChart(session);
  if (!chart) return null;
  return (
    <div>
      <div style={S.head}>
        <span style={S.title}>Heart rate · {chart.minutes} min recorded</span>
        <span style={S.range}>
          {chart.low}–{chart.high} bpm
        </span>
      </div>
      <div style={S.frame}>
        <Line chart={chart} avg={session.hr_avg} />
        <Zones chart={chart} />
      </div>
    </div>
  );
}
