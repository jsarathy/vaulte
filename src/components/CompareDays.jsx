// src/components/CompareDays.jsx — the Compare tab's five day columns: a date head (click to swap
// the day via a prompt) over the day's food kcal and macro rows, or "—" for a slot with no day
import { fmt, formatDateShort, getDayTotals } from "../constants/helpers";
import { C } from "../constants/design";
import { MACRO_ROWS, slotDay, swapSlot } from "../lib/referenceDiet";
import {
  daysPaneStyle,
  daysTitleStyle,
  daysHintStyle,
  daysGridStyle,
  columnStyle,
  columnHeadStyle,
  columnDateStyle,
  columnBodyStyle,
  noDayStyle,
  kcalStyle,
  kcalLabelStyle,
  macroRowStyle,
  macroNameStyle,
  macroValueStyle,
} from "../styles/compareStyles";

const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.hint} strokeWidth="1.5">
    <path d="M2 3.5l3 3 3-3" />
  </svg>
);

function DayTotals({ day }) {
  if (!day) return <div style={noDayStyle}>—</div>;
  const t = getDayTotals(day);
  return (
    <>
      <div style={kcalStyle}>{fmt(t.foodKcal)}</div>
      <div style={kcalLabelStyle}>kcal</div>
      {MACRO_ROWS.map(([label, key]) => (
        <div key={label} style={macroRowStyle}>
          <span style={macroNameStyle}>{label}</span>
          <span style={macroValueStyle}>{fmt(t[key])}g</span>
        </div>
      ))}
    </>
  );
}

function DayColumn({ date, day, onPick }) {
  return (
    <div style={columnStyle}>
      <div onClick={onPick} style={columnHeadStyle}>
        <span style={columnDateStyle}>{date ? formatDateShort(date) : "— pick —"}</span>
        <Chevron />
      </div>
      <div style={columnBodyStyle}>
        <DayTotals day={day} />
      </div>
    </div>
  );
}

export default function CompareDays({ slots, data, allDays, setSlots, setData }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const pick = (idx) => {
    const date = prompt("Date (YYYY-MM-DD):", slots[idx] || todayStr);
    if (!date) return;
    const next = swapSlot({ slots, data }, idx, { date, allDays });
    setSlots(next.slots);
    setData(next.data);
  };
  return (
    <div style={daysPaneStyle}>
      <div style={{ marginBottom: "12px" }}>
        <div style={daysTitleStyle}>Compare days</div>
        <div style={daysHintStyle}>Click a date to swap it out</div>
      </div>
      <div style={daysGridStyle}>
        {slots.map((date, idx) => (
          <DayColumn
            key={idx}
            date={date}
            day={slotDay(date, allDays, data[idx])}
            onPick={() => pick(idx)}
          />
        ))}
      </div>
    </div>
  );
}
