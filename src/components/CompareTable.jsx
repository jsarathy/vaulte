// src/components/CompareTable.jsx — the Compare tab's five days on a phone as ONE card: the macro
// names run down the left once, a column per day to the right (the head is tapped to swap the day)
import { fmt, formatDateShort, getDayTotals } from "../constants/helpers";
import { C, FONT } from "../constants/design";
import { MACRO_ROWS } from "../lib/referenceDiet";

const CARD = {
  background: "#fff",
  border: `0.5px solid ${C.border}`,
  borderRadius: "8px",
  overflow: "hidden",
};
const TABLE = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };
const NAME_COL = { width: "52px" };
const HEAD = {
  background: C.bg,
  borderBottom: `0.5px solid ${C.border}`,
  padding: 0,
  fontWeight: "500",
  fontSize: "11px",
  color: C.text,
};
const HEAD_BUTTON = {
  width: "100%",
  background: "none",
  border: "none",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  padding: "4px 2px",
  lineHeight: 1.2,
};
const NAME = { fontSize: "11px", color: C.muted, padding: "5px 6px", textAlign: "left" };
const VALUE = (big) => ({
  fontFamily: FONT.mono,
  fontSize: big ? "13px" : "11px",
  fontWeight: "500",
  color: C.text,
  textAlign: "center",
  padding: "5px 1px",
  whiteSpace: "nowrap",
});
const ROW = { borderBottom: `0.5px solid ${C.border}` };

function HeadRow({ days, onPick }) {
  return (
    <tr>
      <th style={HEAD} />
      {days.map(({ date }, i) => (
        <th key={i} style={HEAD}>
          <button className="tap-target" onClick={() => onPick(i)} style={HEAD_BUTTON}>
            {date ? formatDateShort(date) : "— pick —"}
          </button>
        </th>
      ))}
    </tr>
  );
}

function ValueRow({ label, big, cells }) {
  return (
    <tr style={ROW}>
      <th scope="row" style={NAME}>
        {label}
      </th>
      {cells.map((c, i) => (
        <td key={i} style={VALUE(big)}>
          {c}
        </td>
      ))}
    </tr>
  );
}

/** days: [{ date, day }] in slot order; onPick(idx) swaps a slot. */
export default function CompareTable({ days, onPick }) {
  const totals = days.map(({ day }) => (day ? getDayTotals(day) : null));
  return (
    <div style={CARD}>
      <table style={TABLE}>
        <colgroup>
          <col style={NAME_COL} />
          {days.map((_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        <thead>
          <HeadRow days={days} onPick={onPick} />
        </thead>
        <tbody>
          <ValueRow label="kcal" big cells={totals.map((t) => (t ? fmt(t.foodKcal) : "—"))} />
          {MACRO_ROWS.map(([label, key]) => (
            <ValueRow
              key={label}
              label={label}
              cells={totals.map((t) => (t ? `${fmt(t[key])}g` : "—"))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
