// src/components/TrajectoryFrame.jsx — a Trajectory panel's frame (Weight and Body tabs): heading
// with the metric tabs, and the chart box. Double-click fills the screen (the heading moves inside);
// Esc or double-click collapses. Render only; chart = useTrajectoryChart().

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
const unwrapped = (style, nowrap) => (nowrap ? { ...style, whiteSpace: "nowrap" } : style);

function ExpandedHeading({ tabs, nowrap }) {
  return (
    <div style={S.fullBar}>
      <div style={S.fullHeading}>
        <span style={unwrapped(S.fullTitle, nowrap)}>📉 Trajectory</span>
        {tabs}
      </div>
      <span style={S.hint}>Esc or double-click to collapse</span>
    </div>
  );
}

/** nowrap: keep the title on one line (Body tab). children: the chart. */
export default function TrajectoryFrame({ chart, tabs, nowrap, children }) {
  return (
    <>
      {!chart.full && (
        <div style={S.heading}>
          <div style={unwrapped(S.title, nowrap)}>📉 Trajectory</div>
          {tabs}
        </div>
      )}
      <div
        onDoubleClick={chart.toggleFull}
        title={chart.full ? "Double-click or press Esc to collapse" : "Double-click to expand"}
        style={chart.full ? S.full : S.compact}
      >
        {chart.full && <ExpandedHeading tabs={tabs} nowrap={nowrap} />}
        {children}
      </div>
    </>
  );
}
