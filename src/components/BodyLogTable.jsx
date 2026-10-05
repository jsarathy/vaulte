// src/components/BodyLogTable.jsx — the Body tab's log table: one row per date (newest first,
// the latest highlighted), an input per site, and a delete button. Render only.
import { BODY_MEASURES } from "../lib/bodyMeasures.js";
import { newestFirst, rowBackground, toReading } from "../lib/bodyLog.js";

const S = {
  box: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    overflow: "auto",
    maxHeight: "calc(100vh - 220px)",
  },
  headRow: { background: "#185FA5", color: "#fff", position: "sticky", top: 0, zIndex: 1 },
  head: {
    padding: "7px 6px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },
  empty: { padding: "18px", textAlign: "center", color: "#9ca3af", fontSize: "12px" },
  date: { padding: "5px 8px", color: "#185FA5", whiteSpace: "nowrap", fontWeight: "600" },
  input: (has) => ({
    width: "50px",
    padding: "2px 4px",
    border: "0.5px solid #e5e7eb",
    borderRadius: "4px",
    fontSize: "12px",
    textAlign: "right",
    background: has ? "#FFF3E0" : "#fff",
    fontWeight: has ? "bold" : "normal",
    color: has ? "#B26A00" : "#1a2a3a",
  }),
  delete: {
    background: "none",
    border: "none",
    color: "#c62828",
    cursor: "pointer",
    fontSize: "13px",
    padding: 0,
  },
};
const HEADS = ["Date", ...BODY_MEASURES.map((m) => m.short), ""];

function Heads() {
  return (
    <thead>
      <tr style={S.headRow}>
        {HEADS.map((h, i) => (
          <th key={h || `c${i}`} style={S.head}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function NoRows() {
  return (
    <tr>
      <td colSpan={BODY_MEASURES.length + 2} style={S.empty}>
        No measurements yet — click a date in the calendar to start a row.
      </td>
    </tr>
  );
}

function Reading({ value, onChange }) {
  return (
    <td style={{ padding: "5px 3px", textAlign: "right" }}>
      <input
        type="number"
        step="0.1"
        min="10"
        max="250"
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(toReading(e.target.value))}
        style={S.input(value != null)}
      />
    </td>
  );
}

function LogRow({ row, i, count, edits }) {
  return (
    <tr style={{ background: rowBackground(i, count) }}>
      <td style={S.date}>{row.date}</td>
      {BODY_MEASURES.map(({ key }) => (
        <Reading key={key} value={row[key]} onChange={(v) => edits.saveField(i, key, v)} />
      ))}
      <td style={{ padding: "5px 6px", textAlign: "center" }}>
        <button onClick={() => edits.deleteRow(row)} title="Delete row" style={S.delete}>
          ×
        </button>
      </td>
    </tr>
  );
}

/** edits: { saveField(i, key, value), deleteRow(row) } from useBodyLogEdits. */
export default function BodyLogTable({ bodyLog, edits }) {
  return (
    <div style={S.box}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <Heads />
        <tbody>
          {bodyLog.length === 0 && <NoRows />}
          {/* Latest first; i stays the index into bodyLog (used by saveField) */}
          {newestFirst(bodyLog).map(({ row, i }) => (
            <LogRow key={row.date || i} row={row} i={i} count={bodyLog.length} edits={edits} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
