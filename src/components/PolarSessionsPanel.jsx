// src/components/PolarSessionsPanel.jsx — body of the Polar Sessions card on Add Entry:
// connect, unlogged sessions to log, or "all logged" with recent sessions. Render only.
import { C, FONT } from "../constants/design.jsx";
import { connectPolar } from "../api/polarSessions";
import {
  sportName,
  fatBurnedGrams,
  syncTimeText,
  pendingWhen,
  recentWhen,
  pendingCountText,
  recentLogged,
} from "../lib/polarSessions.js";

const S = {
  connectTitle: { fontSize: "13px", fontWeight: "bold", color: "#185FA5", marginBottom: "6px" },
  connectText: { fontSize: "11px", color: "#6b7280", marginBottom: "14px", lineHeight: 1.5 },
  connect: {
    background: "#D94032",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "9px 18px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },
  browse: {
    background: C.blueBg,
    color: C.blueText,
    border: `0.5px solid ${C.blueMid}`,
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "11px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: FONT.sans,
  },
  loadRecent: {
    width: "100%",
    background: "transparent",
    border: "none",
    color: C.hint,
    fontSize: "11px",
    cursor: "pointer",
    padding: "4px",
  },
  recentHeading: {
    fontSize: "10px",
    color: C.hint,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    padding: "8px 12px 4px",
  },
  recentRow: {
    padding: "8px 12px",
    borderBottom: `0.5px solid ${C.border}`,
    cursor: "pointer",
    fontSize: "11px",
  },
  recentTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "3px",
  },
  pendingHeading: {
    fontSize: "10px",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: "8px",
    display: "flex",
    justifyContent: "space-between",
  },
  pendingRow: {
    padding: "10px 12px",
    borderRadius: "6px",
    border: "0.5px solid #e5e7eb",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  pendingTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "4px",
  },
  pendingStats: {
    display: "flex",
    gap: "10px",
    fontSize: "11px",
    color: "#378ADD",
    flexWrap: "wrap",
  },
};

function NotConnected({ userId }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 8px" }}>
      <div style={{ fontSize: "32px", marginBottom: "8px" }}>⌚</div>
      <div style={S.connectTitle}>Connect your Polar device</div>
      <div style={S.connectText}>
        Authorise Vaulte to read your training sessions from Polar Flow. After connecting, use Sync
        to pull sessions.
      </div>
      <button onClick={() => connectPolar(userId)} style={S.connect}>
        Connect Polar Account
      </button>
    </div>
  );
}

function RecentRow({ session, onLog }) {
  const fat = fatBurnedGrams(session);
  return (
    <div
      onClick={() => onLog(session)}
      style={S.recentRow}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.blueBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={S.recentTop}>
        <span style={{ fontWeight: "500", color: C.blueText, fontSize: "12px" }}>
          {sportName(session)}
        </span>
        <span style={{ color: C.muted, fontFamily: FONT.mono, fontSize: "10px" }}>
          {recentWhen(session)}
        </span>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", color: C.muted }}>
        <span>{Math.round(session.duration_min || 0)} min</span>
        <span>{session.calories} kcal</span>
        {session.hr_avg && <span>❤ {session.hr_avg} bpm</span>}
        {fat != null && <span>🧈 {fat}g fat</span>}
        {session.hr_samples && <span style={{ color: C.greenText }}>HR ✓</span>}
      </div>
    </div>
  );
}

// Last 10 logged sessions; loaded on request (hidden while loading)
function RecentSessions({ browse, onLog }) {
  if (browse.loading) return null;
  const recent = recentLogged(browse.all);
  if (!recent)
    return (
      <div style={{ borderTop: `0.5px solid ${C.border}`, marginTop: "8px", paddingTop: "8px" }}>
        <button onClick={browse.load} style={S.loadRecent}>
          Load recent sessions ↓
        </button>
      </div>
    );
  if (recent.length === 0) return null;
  return (
    <div style={{ borderTop: `0.5px solid ${C.border}`, marginTop: "8px" }}>
      <div style={S.recentHeading}>Recent sessions</div>
      {recent.map((s) => (
        <RecentRow key={s.id} session={s} onLog={onLog} />
      ))}
    </div>
  );
}

function AllLogged({ lastSync, browse, onLog }) {
  return (
    <div style={{ color: "#6b7280" }}>
      <div style={{ textAlign: "center", padding: "12px 8px 8px" }}>
        <div style={{ fontSize: "28px", marginBottom: "4px" }}>✅</div>
        <div style={{ fontSize: "12px", marginBottom: "4px" }}>All sessions logged.</div>
        {lastSync && (
          <div style={{ fontSize: "10px", color: "#A0B4C8", marginBottom: "8px" }}>
            Last sync: {syncTimeText(lastSync)}
          </div>
        )}
        <div style={{ fontSize: "11px", marginBottom: "10px" }}>
          Sync your H10 to Polar Flow, then click 🔄 Sync above.
        </div>
        <button onClick={browse.show} style={S.browse}>
          Browse all sessions
        </button>
      </div>
      <RecentSessions browse={browse} onLog={onLog} />
    </div>
  );
}

function PendingRow({ session, onLog }) {
  return (
    <div
      onClick={() => onLog(session)}
      style={S.pendingRow}
      onMouseOver={(e) => (e.currentTarget.style.background = "#F0F4F8")}
      onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
    >
      <div style={S.pendingTop}>
        <div style={{ fontWeight: "bold", fontSize: "12px", color: "#185FA5" }}>
          {sportName(session)}
        </div>
        <div style={{ fontSize: "10px", color: "#6b7280" }}>{pendingWhen(session)}</div>
      </div>
      <div style={S.pendingStats}>
        <span>⏱ {Math.round(session.duration_min || 0)} min</span>
        <span>🔥 {session.calories} kcal</span>
        {session.hr_avg && <span>❤️ {session.hr_avg} bpm avg</span>}
        {session.hr_max && <span>↑{session.hr_max} max</span>}
        {session.fat_pct != null && <span>🧈 {session.fat_pct}% fat</span>}
      </div>
    </div>
  );
}

function Pending({ sessions, lastSync, onLog }) {
  return (
    <div>
      <div style={S.pendingHeading}>
        <span>{pendingCountText(sessions.length)}</span>
        {lastSync && <span>Synced {syncTimeText(lastSync)}</span>}
      </div>
      {sessions.map((s) => (
        <PendingRow key={s.id} session={s} onLog={onLog} />
      ))}
    </div>
  );
}

/** polar: { connected, sessions (unlogged), lastSync }; browse: usePolarBrowse(); onLog(session). */
export default function PolarSessionsPanel({ userId, polar, browse, onLog }) {
  if (!polar.connected) return <NotConnected userId={userId} />;
  if (polar.sessions.length === 0)
    return <AllLogged lastSync={polar.lastSync} browse={browse} onLog={onLog} />;
  return <Pending sessions={polar.sessions} lastSync={polar.lastSync} onLog={onLog} />;
}
