// src/components/MilestoneRoadmap.jsx — the plan's milestones: date, weight, note and a phase
// badge. Render only; figures from lib/planSummary.
import { phaseBadge, planMilestones } from "../lib/planSummary.js";

const S = {
  list: { marginBottom: "10px" },
  row: {
    display: "grid",
    gridTemplateColumns: "75px 58px 1fr 34px",
    gap: "4px",
    padding: "3px 0",
    borderBottom: "1px solid #F0F4F8",
    alignItems: "center",
  },
  date: { color: "#6b7280", fontSize: "10px" },
  weight: { color: "#378ADD", fontWeight: "bold" },
  note: { color: "#185FA5" },
  badge: ({ background, color }) => ({
    fontSize: "9px",
    padding: "1px 4px",
    borderRadius: "8px",
    textAlign: "center",
    background,
    color,
  }),
};

function Milestone({ milestone }) {
  const badge = phaseBadge(milestone.phase);
  return (
    <div style={S.row}>
      <span style={S.date}>{milestone.date}</span>
      <span style={S.weight}>{milestone.weight}</span>
      <span style={S.note}>{milestone.note}</span>
      <span style={S.badge(badge)}>{badge.label}</span>
    </div>
  );
}

export default function MilestoneRoadmap({ cfg }) {
  return (
    <div style={S.list}>
      {planMilestones(cfg).map((m, i) => (
        <Milestone key={i} milestone={m} />
      ))}
    </div>
  );
}
