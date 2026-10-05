// src/components/PlanStatsEditor.jsx — the Personal Stats editor in the Plan Specifications card.
// Render only; form = usePlanForm().
import { LABEL, inputStyle } from "./planFormStyles.js";

const GRID = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "8px",
  marginBottom: "10px",
};
// [field, label, input width, step]
const NUMBERS_BEFORE_SEX = [["age", "Age (yr)", 54]];
const NUMBERS_BEFORE_DATE = [
  ["heightCm", "Height (cm)", 54],
  ["startWeightKg", "Start Wt (kg)", 54, 0.1],
];
const NUMBERS_AFTER_DATE = [
  ["vo2max", "VO₂ Max", 54],
  ["targetWeightMinKg", "Target Min (kg)", 54, 0.1],
  ["targetWeightMaxKg", "Target Max (kg)", 54, 0.1],
  ["cumLossBaselineKg", "Cum-loss base (kg)", 54, 0.01],
];

/** A labelled number input. */
export function NumberField({ plan, form, spec: [key, label, width, step = 1] }) {
  return (
    <div>
      <span style={LABEL}>{label}</span>
      <input
        type="number"
        step={step}
        value={plan[key] ?? ""}
        onChange={(e) => form.setNumber(key, e.target.value)}
        style={inputStyle(`${width}px`)}
      />
    </div>
  );
}

const numbers = (specs, plan, form) =>
  specs.map((spec) => <NumberField key={spec[0]} plan={plan} form={form} spec={spec} />);

function SexAndStart({ plan, form }) {
  return (
    <>
      <div>
        <span style={LABEL}>Sex</span>
        <select
          value={plan.sex}
          onChange={(e) => form.setField("sex", e.target.value)}
          style={inputStyle("70px")}
        >
          <option value="m">Male</option>
          <option value="f">Female</option>
        </select>
      </div>
      {numbers(NUMBERS_BEFORE_DATE, plan, form)}
      <div>
        <span style={LABEL}>Start Date</span>
        <input
          type="date"
          value={plan.startDate}
          onChange={(e) => form.setField("startDate", e.target.value)}
          style={inputStyle("110px")}
        />
      </div>
    </>
  );
}

export default function PlanStatsEditor({ plan, form }) {
  return (
    <div style={GRID}>
      {numbers(NUMBERS_BEFORE_SEX, plan, form)}
      <SexAndStart plan={plan} form={form} />
      {numbers(NUMBERS_AFTER_DATE, plan, form)}
    </div>
  );
}
