// src/components/WeightLogPanel.jsx — the Weight tab's left column: heading with Sync Renpho,
// Purge and the sync message, then the log table. Render only; log = useWeightLog().
import useWeightLog from "../hooks/useWeightLog.js";
import WeightLogTable from "./WeightLogTable.jsx";

const S = {
  column: { flex: "0 0 55%", minWidth: 0 },
  heading: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
  title: { fontSize: "15px", fontWeight: "bold", color: "#185FA5" },
  sync: (busy) => ({
    background: busy ? "#9ca3af" : "#378ADD",
    border: "none",
    color: "#fff",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: busy ? "default" : "pointer",
  }),
  purge: {
    background: "#fff",
    border: "0.5px solid #c62828",
    color: "#c62828",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  message: (ok) => ({ fontSize: "11px", color: ok ? "#2E7D32" : "#c62828" }),
  frame: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    overflow: "auto",
    maxHeight: "calc(100vh - 220px)",
  },
};

function Heading({ log, renpho }) {
  return (
    <div style={S.heading}>
      <div style={S.title}>⚖️ Weight Log</div>
      <button onClick={renpho.sync} disabled={renpho.syncing} style={S.sync(renpho.syncing)}>
        {renpho.syncing ? "Syncing…" : "⟳ Sync Renpho"}
      </button>
      {log.stale > 0 && (
        <button onClick={log.purge} style={S.purge}>
          🗑 Purge {log.stale} pre-{log.syncFrom}
        </button>
      )}
      {renpho.msg && <span style={S.message(renpho.msg.ok)}>{renpho.msg.text}</span>}
    </div>
  );
}

/** renpho: { syncing, msg, sync } */
export default function WeightLogPanel({
  userId,
  weightLog,
  setWeightLog,
  cfg,
  purgeBefore,
  renpho,
}) {
  const log = useWeightLog({ userId, weightLog, setWeightLog, cfg, purgeBefore });
  return (
    <div style={S.column}>
      <Heading log={log} renpho={renpho} />
      <div style={S.frame}>
        <WeightLogTable rows={log.rows} saveField={log.saveField} />
      </div>
    </div>
  );
}
