// src/components/MeasurementSites.jsx — the Body tab's "Measurement Sites" panel: the anatomy
// figure and how to measure the chosen (or hovered) site, with its latest reading. Render only.
import { MEASURE } from "../lib/bodyMeasures.js";
import { cmText, latestReadings } from "../lib/anatomy.js";
import AnatomyFigure from "./AnatomyFigure.jsx";

const S = {
  box: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    overflow: "hidden",
    marginBottom: "12px",
  },
  bar: {
    background: "#185FA5",
    color: "#fff",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "bold",
  },
  body: { padding: "10px 12px", display: "flex", gap: "12px", alignItems: "stretch" },
  card: {
    flex: 1,
    minWidth: 0,
    background: "#F7FAFD",
    border: "0.5px solid #cfe0f0",
    borderRadius: "6px",
    padding: "12px 14px",
  },
  kicker: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#378ADD",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
  },
  name: { fontSize: "22px", fontWeight: "bold", color: "#185FA5", marginBottom: "8px" },
  info: { fontSize: "18px", lineHeight: 1.5, color: "#1a2a3a" },
  latest: {
    marginTop: "14px",
    paddingTop: "10px",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    fontSize: "16px",
  },
};

function HowTo({ site, value }) {
  const m = MEASURE[site];
  const has = value != null;
  return (
    <div style={S.card}>
      <div style={S.kicker}>📏 How to measure</div>
      <div style={S.name}>
        {m.label}{" "}
        <span style={{ fontSize: "16px", fontWeight: "normal", color: "#6b7280" }}>(cm)</span>
      </div>
      <div style={S.info}>{m.info}</div>
      <div style={S.latest}>
        <span style={{ color: "#6b7280" }}>Latest</span>
        <span style={{ color: has ? "#B26A00" : "#9ca3af", fontWeight: "bold" }}>
          {has ? cmText(value) : "—"}
        </span>
      </div>
    </div>
  );
}

/** Highlights the site under the hovered (or chosen) pill; chart = useTrajectoryChart(). */
export default function MeasurementSites({ bodyLog, sex, chart }) {
  const site = chart.hoverMetric || chart.metric;
  const latest = latestReadings(bodyLog);
  return (
    <div style={S.box}>
      <div style={S.bar}>
        <span>🧍 Measurement Sites</span>
      </div>
      <div style={S.body}>
        <div style={{ flex: "0 0 48%", minWidth: 0 }}>
          <AnatomyFigure sex={sex} active={site} latest={latest} />
        </div>
        <HowTo site={site} value={latest[site]} />
      </div>
    </div>
  );
}
