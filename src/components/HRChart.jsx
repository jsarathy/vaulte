// src/components/HRChart.jsx — a Polar session's heart-rate line, range and time in zones (in the
// Daily log's Polar session box). Double-click it to expand it to fill the screen (Esc or
// double-click to collapse). Render only; figures from lib/hrChart.
import { C, FONT } from "../constants/design.jsx";
import { useFullView } from "../hooks/useFullView.js";
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
    cursor: "zoom-in",
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

// The expanded view: the whole window; the chart is as wide as the window and keeps its shape.
const F = {
  wrap: {
    position: "fixed",
    inset: 0,
    zIndex: 4000,
    background: "#fff",
    padding: "20px 24px",
    overflowY: "auto",
    cursor: "zoom-out",
    fontFamily: FONT.sans,
  },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontSize: "24px", fontWeight: "bold", color: C.blue },
  hint: { fontSize: "16px", color: C.hint },
  range: { fontFamily: FONT.mono, fontSize: "20px", color: C.muted, margin: "6px 0 14px" },
  svg: { width: "100%", height: "auto", maxHeight: "62vh", display: "block" },
  bar: { height: "14px", borderRadius: "7px", marginTop: "14px" },
  item: { fontSize: "16px", gap: "6px" },
};

// Labels: the scale's top (max + 5) and the lowest reading (5 bpm in from the scale's bottom)
function Line({ chart, avg, svgStyle = S.svg }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle}>
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
        {Math.round(chart.scale.max)} bpm
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

function Zones({ chart, large }) {
  return (
    <>
      <div style={large ? { ...S.bar, ...F.bar } : S.bar}>
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
              <div key={i} style={large ? { ...S.item, ...F.item } : S.item}>
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

function Expanded({ chart, session, collapse }) {
  return (
    <div onDoubleClick={collapse} title="Double-click or press Esc to collapse" style={F.wrap}>
      <div style={F.head}>
        <span style={F.title}>Heart rate · {chart.minutes} min recorded</span>
        <span style={F.hint}>Esc or double-click to collapse</span>
      </div>
      <div style={F.range}>
        {chart.low}–{chart.high} bpm
      </div>
      <Line chart={chart} avg={session.hr_avg} svgStyle={F.svg} />
      <Zones chart={chart} large />
    </div>
  );
}

export default function HRChart({ session }) {
  const chart = hrChart(session);
  const [full, setFull] = useFullView();
  if (!chart) return null;
  if (full) return <Expanded chart={chart} session={session} collapse={() => setFull(false)} />;
  return (
    <div>
      <div style={S.head}>
        <span style={S.title}>Heart rate · {chart.minutes} min recorded</span>
        <span style={S.range}>
          {chart.low}–{chart.high} bpm
        </span>
      </div>
      <div style={S.frame} onDoubleClick={() => setFull(true)} title="Double-click to expand">
        <Line chart={chart} avg={session.hr_avg} />
        <Zones chart={chart} />
      </div>
    </div>
  );
}
