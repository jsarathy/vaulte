// src/components/PlanCurveEditor.jsx — the Projection Curve editor in the Plan Specifications
// card: maintenance kcal, sync-from date and the curve's anchors. Render only; form = usePlanForm().
import { anchorDate, anchorsOf, syncFromValue } from "../lib/planEdits.js";
import { LABEL, inputStyle } from "./planFormStyles.js";
import { NumberField } from "./PlanStatsEditor.jsx";

const COLUMNS = "46px 66px 1fr 20px";
const S = {
  top: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "8px" },
  box: { border: "0.5px solid #e5e7eb", borderRadius: "4px", padding: "6px", marginBottom: "6px" },
  head: {
    display: "grid",
    gridTemplateColumns: COLUMNS,
    gap: "4px",
    fontSize: "9px",
    color: "#9ca3af",
    marginBottom: "3px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: COLUMNS,
    gap: "4px",
    alignItems: "center",
    marginBottom: "3px",
  },
  date: { fontSize: "10px", color: "#6b7280" },
  remove: {
    background: "none",
    border: "none",
    color: "#c62828",
    cursor: "pointer",
    fontSize: "12px",
    padding: 0,
  },
  add: {
    background: "#F7FAFD",
    border: "0.5px solid #e5e7eb",
    color: "#185FA5",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    cursor: "pointer",
    marginTop: "2px",
  },
};

function AnchorRow({ anchor, i, startDate, form }) {
  const set = (key) => (e) => form.setAnchorNumber(i, key, e.target.value);
  return (
    <div style={S.row}>
      <input
        type="number"
        step="1"
        value={anchor.week ?? ""}
        onChange={set("week")}
        style={inputStyle("42px")}
      />
      <input
        type="number"
        step="0.05"
        value={anchor.weightKg ?? ""}
        onChange={set("weightKg")}
        style={inputStyle("62px")}
      />
      <span style={S.date}>{anchorDate(startDate, anchor.week)}</span>
      <button onClick={() => form.removeAnchor(i)} title="Remove" style={S.remove}>
        ×
      </button>
    </div>
  );
}

function Anchors({ plan, form }) {
  return (
    <div style={S.box}>
      <div style={S.head}>
        <span>Week</span>
        <span>Weight</span>
        <span>Date</span>
        <span />
      </div>
      {anchorsOf(plan).map((anchor, i) => (
        <AnchorRow key={i} anchor={anchor} i={i} startDate={plan.startDate} form={form} />
      ))}
      <button onClick={form.addAnchor} style={S.add}>
        + Add anchor
      </button>
    </div>
  );
}

export default function PlanCurveEditor({ plan, form }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={S.top}>
        <NumberField
          plan={plan}
          form={form}
          spec={["maintenanceCaloriesKcal", "Maint. kcal", 60]}
        />
        <div style={{ gridColumn: "span 2" }}>
          <span style={LABEL}>Sync from (ignore earlier)</span>
          <input
            type="date"
            value={syncFromValue(plan)}
            onChange={(e) => form.setField("syncFromDate", e.target.value)}
            style={inputStyle("110px")}
          />
        </div>
      </div>
      <span style={LABEL}>Anchor points (week 0 = Start Weight on Start Date)</span>
      <Anchors plan={plan} form={form} />
    </div>
  );
}
