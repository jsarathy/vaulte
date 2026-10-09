// src/components/WeightLogPanel.jsx — the Weight tab's left column: heading with Sync Renpho,
// Purge and the sync message, then the log table. Render only; log = useWeightLog().
import { useState } from "react";
import useWeightLog from "../hooks/useWeightLog.js";
import PillButton from "./PillButton.jsx";
import PhonePopup from "./PhonePopup.jsx";
import WeightLogTable from "./WeightLogTable.jsx";
import { columnStyle } from "../lib/phoneLayout.js";

const S = {
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
  syncPill: { borderRadius: "999px", minHeight: "40px", padding: "6px 14px", fontSize: "12px" },
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

// title: the heading text (a pill on a phone); after: what sits right of Sync Renpho (the Plan pill)
function Heading({ log, renpho, phone, title, after }) {
  const wrap = phone ? { flexWrap: "wrap", gap: "8px 10px" } : null;
  return (
    <div style={{ ...S.heading, ...wrap }}>
      {title}
      <button
        onClick={renpho.sync}
        disabled={renpho.syncing}
        style={{ ...S.sync(renpho.syncing), ...(phone ? S.syncPill : null) }}
      >
        {renpho.syncing ? "Syncing…" : "⟳ Sync Renpho"}
      </button>
      {after}
      {log.stale > 0 && (
        <button onClick={log.purge} style={S.purge}>
          🗑 Purge {log.stale} pre-{log.syncFrom}
        </button>
      )}
      {renpho.msg && <span style={S.message(renpho.msg.ok)}>{renpho.msg.text}</span>}
    </div>
  );
}

const Table = ({ log, maxHeight }) => (
  <div className="table-frame" style={{ ...S.frame, maxHeight }}>
    <WeightLogTable rows={log.rows} saveField={log.saveField} />
  </div>
);

// Phone: the log is a pill that opens the table in a pop-up; planPill sits right of Sync Renpho
function PhoneLog({ log, renpho, planPill }) {
  const [open, setOpen] = useState(false);
  const name = "⚖️ Weight Log";
  return (
    <div style={columnStyle(true, 55)}>
      <Heading
        log={log}
        renpho={renpho}
        phone
        title={<PillButton onClick={() => setOpen(true)}>{name}</PillButton>}
        after={planPill}
      />
      {open && (
        <PhonePopup title={name} onClose={() => setOpen(false)}>
          <Table log={log} maxHeight="calc(100dvh - 120px)" />
        </PhonePopup>
      )}
    </div>
  );
}

/** renpho: { syncing, msg, sync }; planPill: the phone's Plan pill */
export default function WeightLogPanel({
  userId,
  weightLog,
  setWeightLog,
  cfg,
  purgeBefore,
  renpho,
  phone,
  planPill,
}) {
  const log = useWeightLog({ userId, weightLog, setWeightLog, cfg, purgeBefore });
  if (phone) return <PhoneLog log={log} renpho={renpho} planPill={planPill} />;
  const title = <div style={S.title}>⚖️ Weight Log</div>;
  return (
    <div style={columnStyle(phone, 55)}>
      <Heading log={log} renpho={renpho} phone={phone} title={title} />
      <Table log={log} maxHeight={S.frame.maxHeight} />
    </div>
  );
}
