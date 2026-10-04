// src/components/ExerciseLogModal.jsx — "Log Exercise": pick an exercise, estimate the burn,
// log it into a meal slot. Render only; state in useExerciseLog, logic in lib/exerciseLog.
import { EXERCISE_COMPENDIUM } from "../constants/exercises";
import { filterExercises, estimateTiles, WEIGHT_KG } from "../lib/exerciseLog.js";

const box = { border: "0.5px solid #e5e7eb", borderRadius: "4px" };
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    background: "#fff",
    borderRadius: "12px",
    width: "560px",
    maxWidth: "95vw",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
  },
  header: {
    background: "#185FA5",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: "12px 12px 0 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  close: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "22px",
    cursor: "pointer",
    lineHeight: 1,
  },
  search: {
    width: "100%",
    padding: "8px 12px",
    border: "2px solid #378ADD",
    borderRadius: "6px",
    fontSize: "13px",
    boxSizing: "border-box",
    outline: "none",
    marginBottom: "10px",
  },
  list: {
    maxHeight: "200px",
    overflowY: "auto",
    border: "0.5px solid #e5e7eb",
    borderRadius: "6px",
    marginBottom: "12px",
  },
  row: (picked) => ({
    padding: "8px 12px",
    borderBottom: "1px solid #F0F4F8",
    cursor: "pointer",
    fontSize: "12px",
    background: picked ? "#E6F1FB" : "transparent",
  }),
  inputs: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" },
  label: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase", marginBottom: "2px" },
  input: { ...box, width: "100%", padding: "6px 8px", fontSize: "12px" },
  calculate: (off) => ({
    width: "100%",
    background: off ? "#ccc" : "#378ADD",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "9px",
    cursor: off ? "not-allowed" : "pointer",
    fontSize: "13px",
    fontWeight: "bold",
    marginBottom: "12px",
  }),
  resultTitle: { fontWeight: "bold", color: "#185FA5", fontSize: "13px", marginBottom: "8px" },
  tiles: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" },
  tile: { ...box, background: "#fff", borderRadius: "6px", padding: "7px 10px" },
  slot: { ...box, flex: 1, padding: "6px 8px", fontSize: "12px" },
  logIt: {
    background: "#2E7D32",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  msg: (ok) => ({
    marginTop: "8px",
    padding: "6px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    background: ok ? "#E8F5E9" : "#FFEBEE",
    color: ok ? "#2E7D32" : "#c62828",
  }),
};

function ExerciseList({ log }) {
  return (
    <div style={S.list}>
      {filterExercises(EXERCISE_COMPENDIUM, log.search).map((ex) => (
        <div
          key={ex.name}
          onClick={() => log.pick(ex)}
          style={S.row(log.selected?.name === ex.name)}
        >
          <div style={{ fontWeight: "bold", color: "#185FA5" }}>{ex.name}</div>
          <div style={{ fontSize: "10px", color: "#6b7280" }}>
            {ex.cat} · MET {ex.met}
          </div>
        </div>
      ))}
    </div>
  );
}

// Weight is fixed: shown read-only (no change handler)
function Inputs({ log }) {
  const fields = [
    ["Duration (min)", log.durationText, log.setDuration],
    ["Avg HR (opt)", log.hrText, log.setHr],
    ["Weight (kg)", String(WEIGHT_KG), null],
  ];
  return (
    <div style={S.inputs}>
      {fields.map(([label, value, set]) => (
        <div key={label}>
          <div style={S.label}>{label}</div>
          <input
            type="number"
            value={value}
            onChange={set ? (e) => set(e.target.value) : undefined}
            style={S.input}
          />
        </div>
      ))}
    </div>
  );
}

function LogToSlot({ log, slots }) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <select value={log.mealId} onChange={(e) => log.setMealId(e.target.value)} style={S.slot}>
        <option value="">— select meal slot —</option>
        {slots.map((o) => (
          <option key={o.key} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button onClick={log.log} style={S.logIt}>
        ✓ Log It
      </button>
    </div>
  );
}

function Result({ log, slots }) {
  return (
    <div style={{ background: "#F0F4F8", borderRadius: "8px", padding: "12px" }}>
      <div style={S.resultTitle}>
        {log.selected.name} · {log.result.mins} min
      </div>
      <div style={S.tiles}>
        {estimateTiles(log.result).map(([label, value]) => (
          <div key={label} style={S.tile}>
            <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>{label}</div>
            <div style={{ fontWeight: "bold", fontSize: "12px", color: "#185FA5" }}>{value}</div>
          </div>
        ))}
      </div>
      <LogToSlot log={log} slots={slots} />
      {log.msg && <div style={S.msg(log.msg.ok)}>{log.msg.text}</div>}
    </div>
  );
}

/** log: useExerciseLog(); slots: mealSlotOptions() for the Add Entry day. */
export default function ExerciseLogModal({ log, slots }) {
  const off = !log.selected || !log.durationText;
  return (
    <div onClick={(e) => e.target === e.currentTarget && log.close()} style={S.backdrop}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>🏋️ Log Exercise</div>
          <button onClick={log.close} style={S.close}>
            ×
          </button>
        </div>
        <div style={{ padding: "18px" }}>
          <input
            value={log.search}
            onChange={(e) => log.setSearch(e.target.value)}
            autoFocus
            placeholder="Search exercise… e.g. cycling, yoga, running"
            style={S.search}
          />
          <ExerciseList log={log} />
          <Inputs log={log} />
          <button onClick={log.calculate} style={S.calculate(off)}>
            Calculate
          </button>
          {log.result && <Result log={log} slots={slots} />}
        </div>
      </div>
    </div>
  );
}
