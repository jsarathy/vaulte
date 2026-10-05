// src/components/DayHeader.jsx — the Daily log's date with arrows to the older / newer day.
import { formatDate } from "../constants/helpers";
import { C, IconChevronLeft, IconChevronRight } from "../constants/design.jsx";
import { adjacentDay } from "../lib/dayBudget.js";

const ARROW = {
  width: "26px",
  height: "26px",
  border: `0.5px solid ${C.borderMid}`,
  borderRadius: "5px",
  background: "#fff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: C.muted,
};
const ROW = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "12px",
};

export default function DayHeader({ date, allDays, switchDay }) {
  const go = (step) => {
    const next = adjacentDay(allDays, date, step);
    if (next) switchDay(next);
  };
  return (
    <div style={ROW}>
      <div style={{ fontSize: "14px", fontWeight: "500", color: C.text }}>{formatDate(date)}</div>
      <div style={{ display: "flex", gap: "4px" }}>
        <button onClick={() => go(1)} style={ARROW}>
          <IconChevronLeft size={12} />
        </button>
        <button onClick={() => go(-1)} style={ARROW}>
          <IconChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
