// src/components/CalendarSidebar.jsx — the month calendar at the top of the sidebar. Render only;
// the month's days and marks come from lib/calendarMonth.
import { C, FONT, IconChevronLeft, IconChevronRight } from "../constants/design.jsx";
import {
  WEEKDAYS,
  leadingBlanks,
  monthDays,
  monthLabel,
  nextMonth,
  prevMonth,
} from "../lib/calendarMonth.js";

const S = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  arrow: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: C.muted,
    display: "flex",
    alignItems: "center",
    padding: "2px",
  },
  weekdays: {
    display: "grid",
    gridTemplateColumns: "repeat(7,1fr)",
    gap: "1px",
    marginBottom: "2px",
  },
  weekday: {
    textAlign: "center",
    fontSize: "9px",
    fontWeight: "500",
    color: C.hint,
    paddingBottom: "3px",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "1px" },
};

const dayColor = (c) => {
  if (c.open) return "#fff";
  if (c.logged) return C.blueText;
  return c.today ? C.blue : C.muted;
};
const dayStyle = (c) => ({
  textAlign: "center",
  fontSize: "11px",
  padding: "4px 1px",
  borderRadius: "4px",
  cursor: "pointer",
  lineHeight: 1.2,
  fontFamily: FONT.mono,
  background: c.open ? C.blue : c.logged ? C.blueBg : "transparent",
  color: dayColor(c),
  fontWeight: c.open || c.logged ? "500" : "400",
  outline: c.today && !c.open ? `1px solid ${C.blue}` : "none",
  outlineOffset: "-1px",
});

function Day({ cell, onPick }) {
  return (
    <div
      className="tap-target"
      onClick={() => onPick(cell.date)}
      title={cell.kcal ? `${Math.round(cell.kcal)} kcal` : ""}
      style={dayStyle(cell)}
    >
      {cell.day}
      {cell.kcal ? (
        <span style={{ fontSize: "7px", display: "block", opacity: 0.8 }}>
          {Math.round(cell.kcal)}
        </span>
      ) : null}
    </div>
  );
}

function MonthHeader({ cal, go }) {
  return (
    <div style={S.header}>
      <button onClick={() => go(prevMonth(cal))} style={S.arrow}>
        <IconChevronLeft size={12} />
      </button>
      <span style={{ fontSize: "11px", fontWeight: "500", color: C.text }}>{monthLabel(cal)}</span>
      <button onClick={() => go(nextMonth(cal))} style={S.arrow}>
        <IconChevronRight size={12} />
      </button>
    </div>
  );
}

/** switchDay: called with the clicked date ("YYYY-MM-DD"). */
export default function CalendarSidebar(props) {
  const cal = { year: props.calYear, month: props.calMonth };
  const go = (to) => {
    props.setCalYear(to.year);
    props.setCalMonth(to.month);
  };
  const today = new Date().toISOString().split("T")[0];
  const days = monthDays(cal, props.allDays, { currentDate: props.currentDate, today });
  return (
    <div style={{ padding: "12px 10px" }}>
      <MonthHeader cal={cal} go={go} />
      <div style={S.weekdays}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={S.weekday}>
            {d}
          </div>
        ))}
      </div>
      <div style={S.grid}>
        {Array.from({ length: leadingBlanks(cal) }, (_, i) => (
          <div key={"bl" + i} />
        ))}
        {days.map((c) => (
          <Day key={c.date} cell={c} onPick={props.switchDay} />
        ))}
      </div>
    </div>
  );
}
