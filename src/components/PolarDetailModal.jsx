// src/components/PolarDetailModal.jsx — the Daily log's Polar session box: sport and start, stats,
// and the heart-rate chart, or a note with a button to fetch it from Polar. Closes on × or the
// backdrop. Render only; detail = usePolarDetail().
import { C, FONT, border } from "../constants/design.jsx";
import { useHeartRateFetch } from "../hooks/usePolarDetail.js";
import {
  canFetchHeartRate,
  hasHeartRate,
  sessionStats,
  sportTitle,
  startedAt,
} from "../lib/polarDetail.js";
import HRChart from "./HRChart.jsx";

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  box: {
    background: "#fff",
    borderRadius: "10px",
    width: "520px",
    maxWidth: "100%",
    maxHeight: "90dvh",
    overflowY: "auto",
    border: `0.5px solid ${C.border}`,
    fontFamily: FONT.sans,
  },
  header: {
    padding: "14px 18px",
    borderBottom: border,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 1,
  },
  sport: { fontSize: "14px", fontWeight: "500", color: C.text },
  when: { fontSize: "11px", color: C.muted, marginTop: "2px" },
  close: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: C.muted,
    fontSize: "18px",
    lineHeight: 1,
    marginLeft: "12px",
  },
  body: { padding: "16px 18px" },
  stats: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "16px" },
  stat: {
    background: C.bg,
    borderRadius: "6px",
    padding: "9px 11px",
    border: `0.5px solid ${C.border}`,
  },
  statLabel: {
    fontSize: "10px",
    color: C.hint,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    marginBottom: "3px",
  },
  statValue: { fontFamily: FONT.mono, fontWeight: "500", fontSize: "14px", color: C.text },
  noHR: {
    background: C.bg,
    borderRadius: "6px",
    border: `0.5px solid ${C.border}`,
    padding: "16px",
    textAlign: "center",
  },
  note: { fontSize: "12px", color: C.muted, marginBottom: "12px" },
  fetch: (busy) => ({
    background: busy ? C.hint : C.blue,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 18px",
    cursor: busy ? "not-allowed" : "pointer",
    fontSize: "12px",
    fontWeight: "500",
    fontFamily: FONT.sans,
  }),
  error: { fontSize: "11px", color: C.danger, marginTop: "8px" },
};

function Header({ session, onClose }) {
  return (
    <div style={S.header}>
      <div>
        <div style={S.sport}>{sportTitle(session.sport)}</div>
        <div style={S.when}>{startedAt(session.start_time)}</div>
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
          <div style={S.statLabel}>{label}</div>
          <div style={S.statValue}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function FetchHeartRate({ hr }) {
  return (
    <>
      <button onClick={hr.fetchNow} disabled={hr.fetching} style={S.fetch(hr.fetching)}>
        {hr.fetching ? "Fetching…" : "Fetch HR data"}
      </button>
      {hr.error && <div style={S.error}>{hr.error}</div>}
    </>
  );
}

function NoHeartRate({ session, hr }) {
  return (
    <div style={S.noHR}>
      <div style={S.note}>Heart rate data wasn't captured at sync time.</div>
      {canFetchHeartRate(session) && <FetchHeartRate hr={hr} />}
    </div>
  );
}

// Always mounted, so a fetch's state outlives the box (as before)
export default function PolarDetailModal({ detail, userId }) {
  const session = detail.session;
  const hr = useHeartRateFetch(session, userId, detail.setSession);
  if (!session) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && detail.close()} style={S.backdrop}>
      <div style={S.box}>
        <Header session={session} onClose={detail.close} />
        <div style={S.body}>
          <Stats session={session} />
          {hasHeartRate(session) ? (
            <HRChart session={session} />
          ) : (
            <NoHeartRate session={session} hr={hr} />
          )}
        </div>
      </div>
    </div>
  );
}
