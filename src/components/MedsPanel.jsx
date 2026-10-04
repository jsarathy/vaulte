// src/components/MedsPanel.jsx — Meds in the Daily log sidebar. Render only; state in useMeds.
// Reads and writes the same routine_log/{date} documents as the routine tasks.
import { C, FONT } from "../constants/design.jsx";
import { useMeds } from "../hooks/useMeds";

const S = {
  panel: { borderTop: `0.5px solid ${C.border}`, padding: "10px 12px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "6px",
  },
  title: {
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: C.muted,
  },
  count: (all) => ({ fontSize: "12px", fontFamily: FONT.mono, color: all ? "#2E7D32" : C.hint }),
  nameRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  name: (filled) => ({ fontSize: "12px", color: filled ? C.text : C.hint, lineHeight: "1.35" }),
  time: { fontSize: "10px", fontFamily: FONT.mono, color: C.hint },
  input: (filled) => ({
    width: "100%",
    padding: "5px 7px",
    marginTop: "3px",
    fontSize: "13px",
    fontFamily: FONT.sans,
    border: `0.5px solid ${filled ? "#2E7D32" : C.border}`,
    borderRadius: "4px",
    background: filled ? "#F1F8F2" : C.bg,
    color: C.text,
    boxSizing: "border-box",
  }),
};

function MedRow({ med, meds }) {
  return (
    <div style={{ marginBottom: "7px" }}>
      <div style={S.nameRow}>
        <span style={S.name(med.filled)}>{med.name}</span>
        {med.time && <span style={S.time}>{med.time}</span>}
      </div>
      <input
        value={med.value}
        placeholder="—"
        onChange={(e) => meds.type(med.id, e.target.value)}
        onBlur={meds.save}
        style={S.input(med.filled)}
      />
    </div>
  );
}

export default function MedsPanel({ userId, date }) {
  const meds = useMeds(userId, date);
  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={S.title}>Meds</span>
        <span style={S.count(meds.done === meds.total)}>
          {meds.done}/{meds.total}
        </span>
      </div>
      {meds.busy ? (
        <div style={{ fontSize: "12px", color: C.hint }}>Loading…</div>
      ) : (
        meds.meds.map((m) => <MedRow key={m.id} med={m} meds={meds} />)
      )}
    </div>
  );
}
