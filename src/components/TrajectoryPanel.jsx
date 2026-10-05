// src/components/TrajectoryPanel.jsx — the Weight tab's Trajectory panel: heading, metric tabs and
// the chart. Double-click fills the screen; Esc or double-click collapses. Render only.
import useTrajectoryChart from "../hooks/useTrajectoryChart.js";
import MetricTabs from "./MetricTabs.jsx";
import TrajectoryChart from "./TrajectoryChart.jsx";

const S = {
  heading: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
  title: { fontSize: "15px", fontWeight: "bold", color: "#185FA5" },
  full: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "#fff",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
    cursor: "zoom-out",
  },
  compact: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    padding: "12px",
    marginBottom: "12px",
    cursor: "zoom-in",
  },
  fullBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  fullHeading: { display: "flex", alignItems: "center", gap: "12px" },
  fullTitle: { fontSize: "16px", fontWeight: "bold", color: "#185FA5" },
  hint: { fontSize: "11px", color: "#9ca3af" },
};

function ExpandedHeading({ tabs }) {
  return (
    <div style={S.fullBar}>
      <div style={S.fullHeading}>
        <span style={S.fullTitle}>📉 Trajectory</span>
        {tabs}
      </div>
      <span style={S.hint}>Esc or double-click to collapse</span>
    </div>
  );
}

export default function TrajectoryPanel({ weightLog, cfg }) {
  const chart = useTrajectoryChart();
  const tabs = <MetricTabs weightLog={weightLog} chart={chart} />;
  return (
    <>
      {!chart.full && (
        <div style={S.heading}>
          <div style={S.title}>📉 Trajectory</div>
          {tabs}
        </div>
      )}
      <div
        onDoubleClick={chart.toggleFull}
        title={chart.full ? "Double-click or press Esc to collapse" : "Double-click to expand"}
        style={chart.full ? S.full : S.compact}
      >
        {chart.full && <ExpandedHeading tabs={tabs} />}
        <TrajectoryChart weightLog={weightLog} cfg={cfg} chart={chart} />
      </div>
    </>
  );
}
