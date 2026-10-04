// src/components/WeightEntryModal.jsx — add / edit / delete one weight_log row. Render only;
// state and actions in useWeightEntry.
import { C, FONT } from "../constants/design.jsx";

const BOX = {
  fontSize: "13px",
  fontFamily: FONT.mono,
  border: `0.5px solid ${C.border}`,
  borderRadius: "5px",
  background: C.surface,
};
const BUTTON = {
  fontSize: "12px",
  borderRadius: "5px",
  cursor: "pointer",
  fontFamily: FONT.sans,
};
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  box: {
    background: C.bg,
    border: `0.5px solid ${C.border}`,
    borderRadius: "8px",
    padding: "18px 20px",
    width: "340px",
    fontFamily: FONT.sans,
  },
  title: { fontSize: "14px", fontWeight: 600, color: C.text, marginBottom: "14px" },
  label: { fontSize: "11px", color: C.hint, marginBottom: "4px" },
  input: { ...BOX, width: "100%", padding: "7px 9px", color: C.text, boxSizing: "border-box" },
  date: { ...BOX, padding: "7px 9px", color: C.muted },
  save: {
    ...BUTTON,
    flex: 1,
    padding: "8px",
    fontWeight: 600,
    border: "none",
    background: C.blue,
    color: "#fff",
  },
  cancel: {
    ...BUTTON,
    flex: 1,
    padding: "8px",
    border: `0.5px solid ${C.border}`,
    background: C.surface,
    color: C.text,
  },
  delete: {
    ...BUTTON,
    padding: "8px 10px",
    border: `0.5px solid ${C.border}`,
    background: C.surface,
    color: "#c0392b",
  },
};
const FIELDS = [
  ["Week", "week", "e.g. 1"],
  ["Dose", "dose", "free text"],
  ["Projected (kg)", "projected", "e.g. 84.0"],
  ["Actual (kg)", "actual", "e.g. 83.4"],
];

function Field({ field: [label, key, placeholder], entry, setEntry }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={S.label}>{label}</div>
      <input
        value={entry[key]}
        placeholder={placeholder}
        onChange={(e) => setEntry((p) => ({ ...p, [key]: e.target.value }))}
        style={S.input}
      />
    </div>
  );
}

function Buttons({ entry, setEntry, onSave, onDelete }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
      <button onClick={onSave} style={S.save}>
        Save
      </button>
      <button onClick={() => setEntry(null)} style={S.cancel}>
        Cancel
      </button>
      {entry.existing && (
        <button onClick={onDelete} style={S.delete}>
          Delete
        </button>
      )}
    </div>
  );
}

/** entry: { date, week, dose, projected, actual, existing } or null (closed). */
export default function WeightEntryModal(props) {
  const { entry, setEntry } = props;
  if (!entry) return null;
  return (
    <div onClick={() => setEntry(null)} style={S.backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={S.box}>
        <div style={S.title}>{entry.existing ? "Edit Weight Entry" : "New Weight Entry"}</div>
        <div style={{ marginBottom: "12px" }}>
          <div style={S.label}>Date</div>
          <div style={S.date}>{entry.date}</div>
        </div>
        {FIELDS.map((f) => (
          <Field key={f[1]} field={f} entry={entry} setEntry={setEntry} />
        ))}
        <Buttons {...props} />
      </div>
    </div>
  );
}
