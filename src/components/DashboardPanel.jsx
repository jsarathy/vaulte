// src/components/DashboardPanel.jsx — the Dashboard (Fix 98): how the apps Vaulte uses are doing.
// One row per app with when it last gave data and a fresh / stale / missing marker, then Claude.
import { useEffect, useState } from "react";
import { hdg } from "../styles/authStyles.js";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { loadDashboard } from "../api/dashboard.js";
import { dashboardRows } from "../lib/dashboard.js";
import AiUsageCard from "./AiUsageCard.jsx";

const eyebrow = {
  color: "rgba(212,175,55,0.4)",
  fontFamily: "'Cinzel',serif",
  fontSize: "10px",
  letterSpacing: "3px",
  marginBottom: "8px",
};
const sectionTitle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  margin: "28px 0 12px",
};
const DOT = { ok: "#6fbf73", stale: "#e0a030", never: "#8a8a8a", error: "#d9534f" };
const STATE_LABEL = { ok: "Up to date", stale: "Stale", never: "No data", error: "Error" };

function AppRow({ app }) {
  return (
    <div className="info-card" data-app={app.id} style={{ alignItems: "center", gap: "14px" }}>
      <span
        role="img"
        aria-label={STATE_LABEL[app.state]}
        style={{
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          background: DOT[app.state],
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ color: "#f0ead6", fontSize: "16px" }}>{app.name}</div>
        <div style={{ color: "rgba(240,234,214,0.55)", fontSize: "13px" }}>{app.text}</div>
      </div>
    </div>
  );
}

export default function DashboardPanel({ userId }) {
  const phone = useIsPhone();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    loadDashboard(userId).then((data) => live && setRows(dashboardRows(data)));
    return () => {
      live = false;
    };
  }, [userId]);
  return (
    <div>
      <div className="fade-up" style={{ marginBottom: "8px" }}>
        <div style={eyebrow}>OVERVIEW</div>
        <h2 style={{ ...hdg, fontSize: "26px", marginBottom: 0 }}>Dashboard</h2>
      </div>
      <div style={sectionTitle}>YOUR APPS</div>
      <div style={{ display: "grid", gap: "12px" }}>
        {rows ? (
          rows.map((app) => <AppRow key={app.id} app={app} />)
        ) : (
          <div style={{ color: "rgba(240,234,214,0.5)" }}>Loading…</div>
        )}
      </div>
      <div style={sectionTitle}>CLAUDE</div>
      <AiUsageCard userId={userId} phone={phone} />
    </div>
  );
}
