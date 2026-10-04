// src/components/SidebarStats.jsx — the sidebar's 7-day average and streak. Render only.
import { C, FONT } from "../constants/design.jsx";
import { sevenDayAverage, streakDays } from "../lib/trackerDays.js";

const ROW = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  padding: "3px 0",
  fontSize: "11px",
};

export default function SidebarStats({ days }) {
  const rows = [
    ["7-day avg", sevenDayAverage(days)],
    ["Streak", streakDays(days, new Date()) + " days"],
  ];
  return (
    <div style={{ borderTop: `0.5px solid ${C.border}`, padding: "10px 12px" }}>
      {rows.map(([k, v]) => (
        <div key={k} style={ROW}>
          <span style={{ color: C.hint }}>{k}</span>
          <span style={{ fontFamily: FONT.mono, fontWeight: "500", color: C.text }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
