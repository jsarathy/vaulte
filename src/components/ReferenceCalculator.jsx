// src/components/ReferenceCalculator.jsx — the Compare tab's Reference Diet Calculator: sex /
// age / height / weight, protein and fat targets, BMR (Mifflin-St Jeor) and a row per activity level
import { C } from "../constants/design";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { bmr, activityRows } from "../lib/referenceDiet";
import {
  calcPaneStyle,
  calcTitleStyle,
  calcGridStyle,
  inputStyle,
  labelStyle,
  bmrStyle,
  bmrValueStyle,
  levelsStyle,
  levelStyle,
  levelHeadStyle,
  levelNameStyle,
  levelKcalStyle,
  levelDescStyle,
  levelMacrosStyle,
} from "../styles/compareStyles";

const Field = ({ label, style, children }) => (
  <div style={style}>
    <span style={labelStyle}>{label}</span>
    {children}
  </div>
);

const NumberInput = ({ value, onChange }) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(+e.target.value)}
    style={inputStyle}
  />
);

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
    {options.map(([v, label]) => (
      <option key={v} value={v}>
        {label}
      </option>
    ))}
  </select>
);

const PROTEIN_OPTIONS = [
  ["0.8", "0.8g/kg standard"],
  ["1.2", "1.2g/kg active"],
  ["1.4", "1.4g/kg 60+ preserve"],
  ["1.6", "1.6g/kg strength"],
  ["2.0", "2.0g/kg performance"],
];
const FAT_OPTIONS = ["25", "30", "35", "40"].map((v) => [v, `${v}%`]);

function BodyFields({ p }) {
  return (
    <div style={calcGridStyle}>
      <Field label="Sex">
        <Select
          value={p.calcSex}
          onChange={p.setCalcSex}
          options={[
            ["m", "Male"],
            ["f", "Female"],
          ]}
        />
      </Field>
      <Field label="Age">
        <NumberInput value={p.calcAge} onChange={p.setCalcAge} />
      </Field>
      <Field label="Height cm">
        <NumberInput value={p.calcHeight} onChange={p.setCalcHeight} />
      </Field>
      <Field label="Weight kg">
        <NumberInput value={p.calcWeight} onChange={p.setCalcWeight} />
      </Field>
    </div>
  );
}

function ActivityLevel({ row, first }) {
  const { macros: m } = row;
  return (
    <div style={levelStyle(first)}>
      <div style={levelHeadStyle}>
        <span style={levelNameStyle(first)}>{row.label}</span>
        <span style={levelKcalStyle(first)}>{row.td.toLocaleString()}</span>
      </div>
      <div style={levelDescStyle}>{row.desc}</div>
      <div style={levelMacrosStyle}>
        P:{m.protein_g}g F:{m.fat_g}g C:{m.carbs_g}g
      </div>
    </div>
  );
}

function TargetFields({ p }) {
  return (
    <>
      <Field label="Protein target" style={{ marginBottom: "8px" }}>
        <Select
          value={p.calcProtein}
          onChange={(v) => p.setCalcProtein(+v)}
          options={PROTEIN_OPTIONS}
        />
      </Field>
      <Field label="Fat % of calories" style={{ marginBottom: "12px" }}>
        <Select value={p.calcFatPct} onChange={(v) => p.setCalcFatPct(+v)} options={FAT_OPTIONS} />
      </Field>
    </>
  );
}

// Phone: full width under the days instead of a 290 px column beside them
const PHONE_PANE = {
  ...calcPaneStyle,
  width: "auto",
  borderLeft: "none",
  borderTop: `0.5px solid ${C.border}`,
  overflowY: "visible",
};

export default function ReferenceCalculator({ p }) {
  const phone = useIsPhone();
  const BMR = bmr({ sex: p.calcSex, age: p.calcAge, height: p.calcHeight, weight: p.calcWeight });
  const rows = activityRows(BMR, {
    weight: p.calcWeight,
    proteinPerKg: p.calcProtein,
    fatPct: p.calcFatPct,
  });
  return (
    <div style={phone ? PHONE_PANE : calcPaneStyle}>
      <div style={calcTitleStyle}>Reference calculator</div>
      <BodyFields p={p} />
      <TargetFields p={p} />
      <div style={bmrStyle}>
        BMR <span style={bmrValueStyle}>{Math.round(BMR).toLocaleString()}</span> kcal · Mifflin-St
        Jeor
      </div>
      <div style={levelsStyle}>
        {rows.map((row, i) => (
          <ActivityLevel key={i} row={row} first={i === 0} />
        ))}
      </div>
    </div>
  );
}
