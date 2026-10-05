// src/components/PlanSpecsCard.jsx — the Weight tab's Plan Specifications card: heading with
// Edit / Cancel / Save Plan, Personal Stats and Projection Curve (the editors while editing, else
// label / value lists) and the Milestone Roadmap. Render only; plan = usePlanEditing().
import { curveSummary, personalStats } from "../lib/planSummary.js";
import MilestoneRoadmap from "./MilestoneRoadmap.jsx";

const button = {
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: "#fff",
  borderRadius: "4px",
  padding: "3px 10px",
  fontSize: "11px",
  cursor: "pointer",
};
const S = {
  card: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    overflow: "hidden",
    marginBottom: "12px",
  },
  heading: {
    background: "#185FA5",
    color: "#fff",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "bold",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttons: { display: "flex", gap: "6px" },
  button,
  save: { ...button, background: "#2E7D32", fontWeight: "bold" },
  body: { padding: "10px 12px", fontSize: "11px" },
  section: {
    fontSize: "10px",
    fontWeight: "bold",
    color: "#378ADD",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
  },
  pairs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", marginBottom: "10px" },
  pair: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #F0F4F8",
    padding: "2px 0",
  },
  label: { color: "#6b7280" },
  value: { color: "#185FA5", fontWeight: "600" },
};

function Buttons({ plan }) {
  if (!plan.editing)
    return (
      <button onClick={plan.edit} style={S.button}>
        ✏ Edit
      </button>
    );
  return (
    <>
      <button onClick={plan.cancel} style={S.button}>
        Cancel
      </button>
      <button onClick={plan.save} style={S.save}>
        💾 Save Plan
      </button>
    </>
  );
}

function Pairs({ rows }) {
  return (
    <div style={S.pairs}>
      {rows.map(([label, value]) => (
        <div key={label} style={S.pair}>
          <span style={S.label}>{label}</span>
          <span style={S.value}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/** statsEditor / curveEditor: shown in place of the lists while editing. */
export default function PlanSpecsCard({ cfg, plan, statsEditor, curveEditor }) {
  return (
    <div style={S.card}>
      <div style={S.heading}>
        <span>📋 Plan Specifications</span>
        <div style={S.buttons}>
          <Buttons plan={plan} />
        </div>
      </div>
      <div style={S.body}>
        <div style={S.section}>👤 Personal Stats</div>
        {plan.editing ? statsEditor : <Pairs rows={personalStats(cfg)} />}
        <div style={S.section}>📈 Projection Curve</div>
        {plan.editing ? curveEditor : <Pairs rows={curveSummary(cfg)} />}
        <div style={S.section}>🏁 Milestone Roadmap</div>
        <MilestoneRoadmap cfg={cfg} />
      </div>
    </div>
  );
}
