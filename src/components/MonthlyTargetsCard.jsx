// src/components/MonthlyTargetsCard.jsx — monthly targets form (left column, under the calendar).
// Follows the month shown on the calendar; loading and saving live in useMonthlyTargets.
import { C, FONT } from "../constants/design.jsx";
import {
  TARGET_FIELDS,
  actualKey,
  actualStatus,
  monthKeyOf,
  monthLabelOf,
} from "../lib/monthlyTargets";
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
const pairStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" };
const captionStyle = { ...pairStyle, fontSize: "10px", color: C.hint, margin: "0 2px 2px" };
const verdictStyle = (ok) => ({
  fontSize: "10px",
  textAlign: "right",
  marginTop: "1px",
  color: ok ? C.greenText : C.danger,
});
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
      <div style={captionStyle}>
        <span>Target</span>
        <span>Actual</span>
      </div>
      {TARGET_FIELDS.map((f) => (
        <TargetField key={f.key} field={f} vals={vals} onChange={onChange} />
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

function TargetField({ field, vals, onChange }) {
  const verdict = actualStatus(field.key, vals[field.key], vals[actualKey(field.key)]);
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={labelRowStyle}>
        <span>
          {field.label}
          {field.unit ? ` (${field.unit})` : ""}
        </span>
        {field.tol && <span>{field.tol}</span>}
      </div>
      <div style={pairStyle}>
        <ValueInput field={field} name={field.key} kind="target" vals={vals} onChange={onChange} />
        <ValueInput
          field={field}
          name={actualKey(field.key)}
          kind="actual"
          vals={vals}
          onChange={onChange}
        />
      </div>
      {verdict && <div style={verdictStyle(verdict === "ok")}>{VERDICT[verdict]}</div>}
    </div>
  );
}

const VERDICT = { ok: "✓ on target", off: "off target" };

function ValueInput({ field, name, kind, vals, onChange }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step={field.step}
      value={vals[name]}
      placeholder="—"
      aria-label={`${field.label} ${kind}`}
      onChange={(e) => onChange(name, e.target.value)}
      style={inputStyle}
    />
  );
}
