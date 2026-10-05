// src/components/BodyLogPanel.jsx — the Body tab's left column: heading, Renpho tape sync button
// and its message, and the log table. Render only.
import { useBodyLogEdits, useTapeSync } from "../hooks/useBodyLog.js";
import BodyLogTable from "./BodyLogTable.jsx";

const S = {
  bar: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" },
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
};

function SyncNote({ msg }) {
  if (msg)
    return (
      <span style={{ fontSize: "11px", color: msg.ok ? "#2E7D32" : "#c62828" }}>{msg.text}</span>
    );
  return (
    <span style={{ fontSize: "11px", color: "#9ca3af" }}>
      cm · click a date in the calendar to add a row
    </span>
  );
}

export default function BodyLogPanel({ userId, bodyLog, setBodyLog }) {
  const edits = useBodyLogEdits(userId, bodyLog, setBodyLog);
  const tape = useTapeSync(userId, bodyLog, setBodyLog);
  return (
    <div style={{ flex: "0 0 55%", minWidth: 0 }}>
      <div style={S.bar}>
        <div style={S.title}>📏 Body Log</div>
        <button onClick={tape.syncBody} disabled={tape.syncing} style={S.sync(tape.syncing)}>
          {tape.syncing ? "Syncing…" : "⟳ Sync Renpho"}
        </button>
        <SyncNote msg={tape.syncMsg} />
      </div>
      <BodyLogTable bodyLog={bodyLog} edits={edits} />
    </div>
  );
}
