// src/components/PolarBrowseModal.jsx — "All Polar sessions": every synced session, with a
// filter; clicking one opens the log box. Render only; data in usePolarBrowse.
import { C, FONT } from "../constants/design.jsx";
import {
  sportName,
  browseWhen,
  browseStats,
  browseCountsText,
  matchesSearch,
} from "../lib/polarSessions.js";

const SEARCH_HINT = "Filter by date (e.g. 17 Mar, 2026-03) or activity (cycling, running…)";
const line = `0.5px solid ${C.border}`;
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
    width: "580px",
    maxWidth: "100%",
    maxHeight: "88dvh",
    display: "flex",
    flexDirection: "column",
    border: line,
    fontFamily: FONT.sans,
  },
  header: {
    padding: "14px 18px",
    borderBottom: line,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  close: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: C.muted,
    fontSize: "18px",
    lineHeight: 1,
  },
  search: {
    width: "100%",
    padding: "7px 10px",
    border: `0.5px solid ${C.borderMid}`,
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: FONT.sans,
    outline: "none",
    boxSizing: "border-box",
  },
  message: (color) => ({ textAlign: "center", padding: "32px", color, fontSize: "12px" }),
  card: (logged) => ({
    padding: "10px 12px",
    borderRadius: "7px",
    border: line,
    marginBottom: "7px",
    cursor: logged ? "default" : "pointer",
    background: logged ? "#fafafa" : "#fff",
    opacity: logged ? 0.7 : 1,
    transition: "background 0.12s",
  }),
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "5px",
  },
  badge: {
    fontSize: "9px",
    background: C.greenBg,
    color: C.greenText,
    borderRadius: "20px",
    padding: "1px 6px",
    fontWeight: "500",
  },
  footer: {
    padding: "10px 18px",
    borderTop: line,
    fontSize: "11px",
    color: C.hint,
    flexShrink: 0,
    display: "flex",
    justifyContent: "space-between",
  },
};

function Stats({ session }) {
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {browseStats(session).map(([label, value]) => (
        <div key={label} style={{ fontSize: "10px", color: C.muted }}>
          <span style={{ color: C.hint }}>{label} </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontWeight: "500",
              color: label === "HR data" ? C.greenText : C.text,
            }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Hover highlight only for sessions still to log
function SessionCard({ session, onPick }) {
  const { logged } = session;
  return (
    <div
      onClick={() => onPick(session)}
      style={S.card(logged)}
      onMouseEnter={(e) => !logged && (e.currentTarget.style.background = C.blueBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = logged ? "#fafafa" : "#fff")}
    >
      <div style={S.cardTop}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span
            style={{ fontSize: "12px", fontWeight: "500", color: logged ? C.muted : C.blueText }}
          >
            {sportName(session)}
          </span>
          {logged && <span style={S.badge}>logged</span>}
        </div>
        <span style={{ fontSize: "11px", color: C.muted, fontFamily: FONT.mono }}>
          {browseWhen(session)}
        </span>
      </div>
      <Stats session={session} />
    </div>
  );
}

function SessionList({ browse, onPick }) {
  if (browse.loading) return <div style={S.message(C.muted)}>Loading sessions…</div>;
  const shown = browse.all.filter((s) => matchesSearch(s, browse.search));
  if (shown.length === 0) return <div style={S.message(C.hint)}>No sessions match</div>;
  return shown.map((s) => <SessionCard key={s.id} session={s} onPick={onPick} />);
}

/** browse: usePolarBrowse(); onLog(session) opens the log box. */
export default function PolarBrowseModal({ browse, onLog }) {
  const pick = (session) => {
    browse.close();
    onLog(session);
  };
  return (
    <div onClick={(e) => e.target === e.currentTarget && browse.close()} style={S.backdrop}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={{ fontSize: "13px", fontWeight: "500", color: C.text }}>
            All Polar sessions
          </div>
          <button onClick={browse.close} style={S.close}>
            ×
          </button>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: line, flexShrink: 0 }}>
          <input
            type="text"
            value={browse.search}
            onChange={(e) => browse.setSearch(e.target.value)}
            placeholder={SEARCH_HINT}
            autoFocus
            style={S.search}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px" }}>
          <SessionList browse={browse} onPick={pick} />
        </div>
        {!browse.loading && (
          <div style={S.footer}>
            <span>{browseCountsText(browse.all)}</span>
            <span>Click any unlogged session to log it</span>
          </div>
        )}
      </div>
    </div>
  );
}
