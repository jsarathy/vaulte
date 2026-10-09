// src/components/PolarCard.jsx — the Polar Sessions card on Add Entry: header with Sync and
// Reconnect, the last sync message, and the sessions list.
import PolarSessionsPanel from "./PolarSessionsPanel";
import { reconnectPolar } from "../api/polarReconnect";
import { usePhoneFold } from "../hooks/usePhoneFold.js";
import FoldTitle from "./FoldTitle.jsx";

const S = {
  card: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    overflow: "hidden",
  },
  header: {
    background: "#185FA5",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  connected: {
    fontSize: "11px",
    color: "#90CAF9",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#4CAF50",
    display: "inline-block",
  },
  sync: (busy) => ({
    background: busy ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    cursor: busy ? "not-allowed" : "pointer",
    fontWeight: "bold",
  }),
  reconnect: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "rgba(255,255,255,0.6)",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    cursor: "pointer",
  },
  msg: (ok) => ({
    padding: "7px 12px",
    fontSize: "11px",
    fontWeight: "bold",
    background: ok ? "#E8F5E9" : "#FFEBEE",
    color: ok ? "#2E7D32" : "#c62828",
    borderBottom: "0.5px solid #e5e7eb",
  }),
};

function ConnectedControls({ userId, polar }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={S.connected}>
        <span style={S.dot} />
        Connected
      </div>
      <button onClick={polar.sync} disabled={polar.syncing} style={S.sync(polar.syncing)}>
        {polar.syncing ? "⏳ Syncing…" : "🔄 Sync"}
      </button>
      <button
        onClick={(e) => reconnectPolar(userId, e.currentTarget)}
        id="polar-reconnect-btn"
        title="Re-authorise with updated permissions for HR data"
        style={S.reconnect}
      >
        Reconnect
      </button>
    </div>
  );
}

/** polar: { connected, sessions, lastSync, syncing, syncMsg, sync }. Folded shut on a phone. */
export default function PolarCard({ userId, polar, browse, onLog }) {
  const fold = usePhoneFold();
  return (
    <div style={S.card}>
      <div style={S.header}>
        <FoldTitle fold={fold} style={S.title}>
          <span style={{ fontSize: "16px" }}>📡</span> Polar Sessions
        </FoldTitle>
        {polar.connected && fold.open && <ConnectedControls userId={userId} polar={polar} />}
      </div>
      {fold.open && polar.syncMsg && (
        <div style={S.msg(polar.syncMsg.ok)}>{polar.syncMsg.text}</div>
      )}
      {fold.open && (
        <div style={{ padding: "12px" }}>
          <PolarSessionsPanel userId={userId} polar={polar} browse={browse} onLog={onLog} />
        </div>
      )}
    </div>
  );
}
