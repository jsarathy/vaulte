// src/components/MetricMenu.jsx — on a phone the Trajectory heading is one button that opens a list
// of the metrics (Weight and the Renpho fields); picking one closes the list. Render only;
// tabs = [[metric, label]], chart = useTrajectoryChart().
import { useState } from "react";

const S = {
  wrap: { position: "relative" },
  button: {
    background: "#fff",
    border: "0.5px solid #cfe0f0",
    borderRadius: "999px",
    color: "#185FA5",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "bold",
    minHeight: "40px",
    padding: "6px 14px",
  },
  list: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    zIndex: 40,
    background: "#fff",
    border: "0.5px solid #cfe0f0",
    borderRadius: "8px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
    maxHeight: "50dvh",
    overflowY: "auto",
    minWidth: "180px",
    padding: "4px",
  },
  item: (active) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    minHeight: "40px",
    padding: "6px 10px",
    background: active ? "#185FA5" : "transparent",
    color: active ? "#fff" : "#374151",
  }),
};

export default function MetricMenu({ tabs, chart }) {
  const [open, setOpen] = useState(false);
  const current = tabs.find(([metric]) => metric === chart.metric)?.[1] ?? "";
  const pick = (metric) => {
    chart.setMetric(metric);
    setOpen(false);
  };
  return (
    <div style={S.wrap} onDoubleClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={S.button}>
        📉 Trajectory · {current} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div style={S.list}>
          {tabs.map(([metric, label]) => (
            <button
              key={metric}
              onClick={() => pick(metric)}
              style={S.item(chart.metric === metric)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
