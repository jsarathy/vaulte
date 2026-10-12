// src/components/DashboardPanel.jsx — the Dashboard (Fix 98, 99): three framed boxes side by side on
// a monitor (stacked on a phone): the apps Vaulte uses with when each last gave data, Claude, and
// links to the infrastructure (Vercel, Firebase, GitHub).
import { useEffect, useState } from "react";
import { hdg } from "../styles/authStyles.js";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { loadDashboard } from "../api/dashboard.js";
import { dashboardRows } from "../lib/dashboard.js";
import { INFRA_LINKS } from "../constants/infraLinks.js";
import AiUsageCard from "./AiUsageCard.jsx";

const eyebrow = {
  color: "rgba(212,175,55,0.4)",
  fontFamily: "'Cinzel',serif",
  fontSize: "10px",
  letterSpacing: "3px",
  marginBottom: "8px",
};
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "20px",
  alignItems: "start",
  marginTop: "24px",
};
const frameStyle = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: "10px",
  padding: "18px",
  background: "rgba(255,255,255,0.02)",
  minWidth: 0,
};
const frameTitle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "14px",
};
const DOT = { ok: "#6fbf73", stale: "#e0a030", never: "#8a8a8a", error: "#d9534f" };
const STATE_LABEL = { ok: "Up to date", stale: "Stale", never: "No data", error: "Error" };
const linkStyle = { color: "rgba(212,175,55,0.9)", fontSize: "15px", textDecoration: "none" };
const muted = { color: "rgba(240,234,214,0.55)", fontSize: "13px" };

function Frame({ title, children }) {
  return (
    <section style={frameStyle} aria-label={title}>
      <div style={frameTitle}>{title}</div>
      {children}
    </section>
  );
}

function AppRow({ app }) {
  return (
    <div className="info-card" data-app={app.id} style={{ alignItems: "center", gap: "12px" }}>
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#f0ead6", fontSize: "15px" }}>{app.name}</div>
        <div style={muted}>{app.text}</div>
      </div>
    </div>
  );
}

function InfraLinks() {
  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {INFRA_LINKS.map((l) => (
        <div key={l.name}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            {l.name}
          </a>
          <div style={muted}>{l.note}</div>
        </div>
      ))}
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
      <div style={gridStyle}>
        <Frame title="YOUR APPS">
          <div style={{ display: "grid", gap: "12px" }}>
            {rows ? (
              rows.map((app) => <AppRow key={app.id} app={app} />)
            ) : (
              <div style={muted}>Loading…</div>
            )}
          </div>
        </Frame>
        <Frame title="CLAUDE">
          <AiUsageCard userId={userId} phone={phone} flush />
        </Frame>
        <Frame title="INFRASTRUCTURE">
          <InfraLinks />
        </Frame>
      </div>
    </div>
  );
}
