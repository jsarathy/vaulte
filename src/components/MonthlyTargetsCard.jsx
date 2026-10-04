// src/components/MonthlyTargetsCard.jsx — monthly targets form (left column, under the calendar).
// Follows the month shown on the calendar; loading and saving live in useMonthlyTargets.
import { C, FONT } from "../constants/design.jsx";
import { TARGET_FIELDS, monthKeyOf, monthLabelOf } from "../lib/monthlyTargets";
import { useMonthlyTargets } from "../hooks/useMonthlyTargets";

const cardStyle = { borderTop: `0.5px solid ${C.border}`, padding: "10px 12px" };
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: "6px",
};
const titleStyle = {
  fontSize: "11px",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: C.muted,
};
const labelRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
  color: C.hint,
  marginBottom: "2px",
};
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "3px 6px",
  border: `0.5px solid ${C.borderMid}`,
  borderRadius: "4px",
  fontSize: "12px",
  fontFamily: FONT.mono,
  textAlign: "right",
  outline: "none",
  background: "#fff",
};

export default function MonthlyTargetsCard({ userId, year, month }) {
  const { vals, status, onChange } = useMonthlyTargets(userId, monthKeyOf(year, month));
  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Targets · {monthLabelOf(year, month)}</span>
        <SaveStatus status={status} />
      </div>
      {TARGET_FIELDS.map((f) => (
        <TargetField key={f.key} field={f} value={vals[f.key]} onChange={onChange} />
      ))}
    </div>
  );
}

function SaveStatus({ status }) {
  const failed = status === "error";
  return (
    <span style={{ fontSize: "10px", color: failed ? C.danger : C.hint }}>
      {failed ? "not saved" : status}
    </span>
  );
}

function TargetField({ field, value, onChange }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={labelRowStyle}>
        <span>
          {field.label}
          {field.unit ? ` (${field.unit})` : ""}
        </span>
        {field.tol && <span>{field.tol}</span>}
      </div>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={field.step}
        value={value}
        placeholder="—"
        onChange={(e) => onChange(field.key, e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
