// src/components/AppleActivityTable.jsx — the Apple Watch card's body: steps / active minutes /
// flights with their kcal and the total, or the "no data" note while open
import { C } from "../constants/design.jsx";
import { activityRows } from "../lib/appleActivity";
import {
  emptyStyle,
  tableStyle,
  thStyle,
  cell,
  num,
  totalRowStyle,
} from "../styles/appleActivityStyles";

const Row = ({ lbl, val, kcal }) => (
  <tr>
    <td style={{ ...cell, color: C.text }}>{lbl}</td>
    <td style={{ ...num, color: C.muted }}>{val}</td>
    <td style={{ ...num, color: C.blueText }}>{kcal}</td>
  </tr>
);

export default function AppleActivityTable({ loading, hasData, a }) {
  if (!loading && !hasData) {
    return <div style={emptyStyle}>No Apple Watch data synced for this day yet</div>;
  }
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {["", "Count", "kcal"].map((h, i) => (
            <th key={i} style={thStyle(i)}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {activityRows(a).map(([lbl, val, kcal]) => (
          <Row key={lbl} lbl={lbl} val={val} kcal={kcal} />
        ))}
        <tr style={totalRowStyle}>
          <td style={{ ...cell, fontWeight: "500", color: C.text, borderBottom: "none" }}>Total</td>
          <td style={{ ...num, borderBottom: "none" }} />
          <td style={{ ...num, fontWeight: "500", color: C.blueText, borderBottom: "none" }}>
            {a.kcal.total}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
