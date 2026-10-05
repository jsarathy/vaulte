// src/components/MetricTabs.jsx — the Trajectory chart's metric tabs (Weight + Renpho metrics)
// and the note shown while one is hovered or focused. Render only; chart = useTrajectoryChart().
import { metricHeading, metricInfo, metricTabs } from "../lib/weightMetrics.js";

const S = {
  row: { display: "flex", flexWrap: "wrap", gap: "4px" },
  tab: { position: "relative", display: "inline-flex" },
  pill: (active) => ({
    border: "0.5px solid #cfe0f0",
    borderRadius: "999px",
    cursor: "pointer",
    padding: "3px 12px",
    fontSize: "11px",
    fontWeight: "bold",
    background: active ? "#185FA5" : "#F7FAFD",
    color: active ? "#fff" : "#6b7280",
  }),
  note: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 40,
    width: "260px",
    maxWidth: "80vw",
    background: "#1f2937",
    color: "#fff",
    borderRadius: "6px",
    padding: "8px 10px",
    textAlign: "left",
    fontSize: "11.5px",
    lineHeight: 1.45,
    fontWeight: "normal",
    boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
    pointerEvents: "none",
  },
  noteTitle: { fontWeight: "bold", marginBottom: "3px" },
};

function MetricNote({ metric }) {
  return (
    <div style={S.note}>
      <div style={S.noteTitle}>{metricHeading(metric)}</div>
      {metricInfo(metric)}
    </div>
  );
}

function MetricTab({ metric, label, chart }) {
  const choose = (e) => {
    e.stopPropagation(); // not a double-click on the chart
    chart.setMetric(metric);
  };
  const show = () => chart.setHoverMetric(metric);
  const hide = () => chart.setHoverMetric(null);
  return (
    <span style={S.tab}>
      <button
        onClick={choose}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={S.pill(chart.metric === metric)}
      >
        {label}
      </button>
      {chart.hoverMetric === metric && <MetricNote metric={metric} />}
    </span>
  );
}

export default function MetricTabs({ weightLog, chart }) {
  return (
    <div onDoubleClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
      <div style={S.row}>
        {metricTabs(weightLog).map(([metric, label]) => (
          <MetricTab key={metric} metric={metric} label={label} chart={chart} />
        ))}
      </div>
    </div>
  );
}
