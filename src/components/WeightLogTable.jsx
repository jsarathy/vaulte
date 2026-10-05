// src/components/WeightLogTable.jsx — the weight log table, latest first: editable Wk / Dose /
// Actual, then vs Proj, Cum Loss and 2-wk Loss. Render only; rows from lib/weightLogTable.
import { numberOrNull } from "../lib/weightEntry.js";

const HEADINGS = ["Wk", "Date", "Dose", "Actual (kg)", "vs Proj", "Cum Loss", "2-wk Loss"];
const NONE = "#ccc";
const GREY = "#6b7280";
const RED = "#c62828";
const GREEN = "#2E7D32";
const VS_PROJ = { up: RED, down: GREEN, flat: GREY }; // over the projection is bad
const TWO_WEEK = { up: GREEN, down: RED, flat: GREY }; // a loss is good
const box = { padding: "2px 4px", border: "0.5px solid #e5e7eb", borderRadius: "4px" };
const S = {
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  headRow: { background: "#185FA5", color: "#fff", position: "sticky", top: 0 },
  th: {
    padding: "7px 8px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },
  row: (view) => ({
    background: view.current ? "#E3F2FD" : view.odd ? "#F7FAFD" : "#fff",
  }),
  cell: { padding: "5px 8px", textAlign: "right" },
  week: {
    width: "38px",
    ...box,
    fontSize: "11px",
    textAlign: "right",
    background: "#fff",
    color: GREY,
  },
  date: (past) => ({
    padding: "5px 8px",
    color: "#185FA5",
    whiteSpace: "nowrap",
    fontWeight: past ? "600" : "normal",
  }),
  doseCell: { padding: "5px 4px", width: "58px" },
  dose: {
    width: "52px",
    ...box,
    fontSize: "11px",
    background: "#fff",
    color: "#1a2a3a",
    boxSizing: "border-box",
  },
  actual: (has) => ({
    width: "60px",
    ...box,
    fontSize: "12px",
    textAlign: "right",
    background: has ? "#E8F5E9" : "#fff",
    fontWeight: has ? "bold" : "normal",
    color: has ? GREEN : "#1a2a3a",
  }),
  vsProj: (tone) => ({
    padding: "5px 8px",
    textAlign: "right",
    fontWeight: "bold",
    color: tone ? VS_PROJ[tone] : NONE,
  }),
  cumLoss: (has) => ({
    padding: "5px 8px",
    textAlign: "right",
    color: has ? "#378ADD" : NONE,
    fontWeight: has ? "bold" : "normal",
  }),
  twoWeek: (tone) => ({
    padding: "5px 8px",
    textAlign: "right",
    fontWeight: tone ? "bold" : "normal",
    color: tone ? TWO_WEEK[tone] : NONE,
  }),
};

function EditCells({ view, saveField }) {
  const { row, index, past } = view;
  const set = (key, toValue) => (e) => saveField(index, key, toValue(e.target.value));
  const has = row.actual != null;
  return (
    <>
      <td style={S.cell}>
        <input
          type="number"
          value={row.week ?? ""}
          placeholder="—"
          onChange={set("week", numberOrNull)}
          style={S.week}
        />
      </td>
      <td style={S.date(past)}>{row.date}</td>
      <td style={S.doseCell}>
        <input
          type="text"
          value={row.dose ?? ""}
          placeholder="—"
          onChange={set("dose", String)}
          style={S.dose}
        />
      </td>
      <td style={S.cell}>
        <input
          type="number"
          step="0.1"
          min="30"
          max="200"
          value={row.actual ?? ""}
          placeholder={past ? "—" : ""}
          onChange={set("actual", numberOrNull)}
          style={S.actual(has)}
        />
      </td>
    </>
  );
}

function WeightRow({ view, saveField }) {
  return (
    <tr style={S.row(view)}>
      <EditCells view={view} saveField={saveField} />
      <td style={S.vsProj(view.vsProj.tone)}>{view.vsProj.text}</td>
      <td style={S.cumLoss(view.cumLoss != null)}>{view.cumLoss ?? "—"}</td>
      <td style={S.twoWeek(view.twoWeek.tone)}>{view.twoWeek.text}</td>
    </tr>
  );
}

export default function WeightLogTable({ rows, saveField }) {
  return (
    <table style={S.table}>
      <thead>
        <tr style={S.headRow}>
          {HEADINGS.map((h) => (
            <th key={h} style={S.th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((view) => (
          <WeightRow key={view.key} view={view} saveField={saveField} />
        ))}
      </tbody>
    </table>
  );
}
