// src/components/PolarLogModal.jsx — "log a Polar session": the session's stats and heart rate,
// a meal slot, and Log session. Render only; state and logging in usePolarLog.
import { C, FONT, border } from "../constants/design.jsx";
import { sessionStats, sessionWhen, sportName } from "../lib/polarLog.js";
import { usePolarLog } from "../hooks/usePolarLog";
import PolarHRSparkline from "./PolarHRSparkline";

const CAPTION = {
  fontSize: "10px",
  color: C.hint,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    background: "#fff",
    borderRadius: "10px",
    width: "440px",
    maxWidth: "95vw",
    border: `0.5px solid ${C.border}`,
    fontFamily: FONT.sans,
  },
  header: {
    padding: "14px 16px",
    borderBottom: border,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  close: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: C.muted,
    fontSize: "18px",
    lineHeight: 1,
  },
  stats: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "14px" },
  stat: {
    background: C.bg,
    borderRadius: "6px",
    padding: "8px 10px",
    border: `0.5px solid ${C.border}`,
  },
  statValue: { fontWeight: "500", fontSize: "13px", color: C.text, fontFamily: FONT.mono },
  select: (picked) => ({
    width: "100%",
    padding: "7px 10px",
    border: `0.5px solid ${picked ? "#d1d5db" : C.danger}`,
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: FONT.sans,
  }),
  cancel: {
    background: "transparent",
    border: `0.5px solid ${C.borderMid}`,
    color: C.muted,
    borderRadius: "6px",
    padding: "7px 14px",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: FONT.sans,
  },
  log: (busy) => ({
    background: busy ? C.muted : C.blue,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "7px 16px",
    cursor: busy ? "not-allowed" : "pointer",
    fontSize: "12px",
    fontWeight: "500",
    fontFamily: FONT.sans,
  }),
};

function Header({ session, onClose }) {
  const when = sessionWhen(session);
  return (
    <div style={S.header}>
      <div>
        <div style={{ fontWeight: "500", fontSize: "13px", color: C.text }}>
          {sportName(session.sport)}
        </div>
        <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>
          {when.dateText}
          {when.timeText ? ` · ${when.timeText}` : ""}
        </div>
      </div>
      <button onClick={onClose} style={S.close}>
        ×
      </button>
    </div>
  );
}

function Stats({ session }) {
  return (
    <div style={S.stats}>
      {sessionStats(session).map(([label, value]) => (
        <div key={label} style={S.stat}>
          <div style={{ ...CAPTION, marginBottom: "2px" }}>{label}</div>
          <div style={S.statValue}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function MealSlot({ log }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ ...CAPTION, marginBottom: "5px" }}>Log to meal slot</div>
      <select
        value={log.mealId}
        onChange={(e) => log.pick(e.target.value)}
        style={S.select(log.mealId)}
      >
        <option value="">— select slot —</option>
        {log.slots.map((m, i) => (
          <option key={m.id || i} value={m.id || "__slot__" + m.name}>
            {m.name}
          </option>
        ))}
      </select>
      {log.err && (
        <div style={{ fontSize: "11px", color: C.danger, marginTop: "4px" }}>{log.err}</div>
      )}
    </div>
  );
}

/** Props: session (null = closed), userId, allDays, persistDay, setCurrentDayData,
 *  currentDate, setPolarSessions, onClose. */
export default function PolarLogModal(props) {
  const log = usePolarLog(props);
  const { session, onClose } = props;
  if (!session) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={S.backdrop}>
      <div style={S.box}>
        <Header session={session} onClose={onClose} />
        <div style={{ padding: "14px 16px" }}>
          <Stats session={session} />
          <PolarHRSparkline session={session} />
          <MealSlot log={log} />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={S.cancel}>
              Cancel
            </button>
            <button disabled={log.logging} onClick={log.log} style={S.log(log.logging)}>
              {log.logging ? "Logging…" : "Log session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
