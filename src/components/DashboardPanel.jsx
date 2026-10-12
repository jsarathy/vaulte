// src/components/DashboardPanel.jsx — the Dashboard (Fix 98, 99): three framed boxes side by side on
// a monitor (large type): the apps Vaulte uses with when each last gave data, Claude, and links to
// the infrastructure. On a phone the three are rubrics; a tap opens that box as a popup that fills
// the window; + opens it and − closes it, as in My Account.
import { useEffect, useState } from "react";
import { hdg } from "../styles/authStyles.js";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { loadDashboard } from "../api/dashboard.js";
import { ago, dashboardRows } from "../lib/dashboard.js";
import { loadErrors } from "../api/errorLog.js";
import { countSince } from "../lib/errorLog.js";
import { CLAUDE_LINK, INFRA_LINKS } from "../constants/infraLinks.js";
import { checkAdmin } from "../api/adminUsers.js";
import AiUsageCard from "./AiUsageCard.jsx";
import UsersModal from "./UsersModal.jsx";
import ErrorsModal from "./ErrorsModal.jsx";

const gold = "rgba(212,175,55,0.6)";
const eyebrow = {
  color: "rgba(212,175,55,0.4)",
  fontFamily: "'Cinzel',serif",
  fontSize: "13px",
  letterSpacing: "3px",
  marginBottom: "10px",
};
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "24px",
  alignItems: "start",
  marginTop: "28px",
};
const frameStyle = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: "12px",
  padding: "24px",
  background: "rgba(255,255,255,0.02)",
  minWidth: 0,
};
const frameTitle = {
  color: gold,
  fontSize: "16px",
  letterSpacing: "3px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "20px",
};
const DOT = { ok: "#6fbf73", stale: "#e0a030", never: "#8a8a8a", error: "#d9534f" };
const STATE_LABEL = { ok: "Up to date", stale: "Stale", never: "No data", error: "Error" };
/** Type sizes: in a box on a monitor, and in a popup on a phone. */
const SIZE = {
  box: { name: "22px", text: "18px", dot: "15px", gap: "16px" },
  popup: { name: "26px", text: "20px", dot: "18px", gap: "18px" },
};

const rubricStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  minHeight: "64px",
  padding: "0 16px",
  marginBottom: "12px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: "10px",
  color: "rgba(212,175,55,0.9)",
  fontSize: "16px",
  letterSpacing: "3px",
  fontFamily: "'Cinzel',serif",
  cursor: "pointer",
};
const popupStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 3000,
  background: "#0d0d0f",
  display: "flex",
  flexDirection: "column",
  color: "#f0ead6",
};
const popupHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 8px 8px 20px",
  borderBottom: "1px solid rgba(212,175,55,0.2)",
  color: gold,
  fontFamily: "'Cinzel',serif",
  fontSize: "28px",
  letterSpacing: "3px",
};
const closeStyle = {
  background: "none",
  border: "none",
  color: gold,
  fontSize: "28px",
  cursor: "pointer",
  minWidth: "56px",
  minHeight: "56px",
};

function AppRows({ rows, size }) {
  if (!rows) return <div style={{ fontSize: size.text, opacity: 0.6 }}>Loading…</div>;
  return (
    <div style={{ display: "grid", gap: "14px" }}>
      {rows.map((app) => (
        <div
          key={app.id}
          className="info-card"
          data-app={app.id}
          style={{ alignItems: "center", gap: size.gap, padding: "16px 18px" }}
        >
          <span
            role="img"
            aria-label={STATE_LABEL[app.state]}
            style={{
              width: size.dot,
              height: size.dot,
              borderRadius: "50%",
              background: DOT[app.state],
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#f0ead6", fontSize: size.name }}>{app.name}</div>
            <div style={{ color: "rgba(240,234,214,0.6)", fontSize: size.text }}>{app.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkList({ links, size }) {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {links.map((l) => (
        <div key={l.name}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "rgba(212,175,55,0.95)", fontSize: size.name, textDecoration: "none" }}
          >
            {l.name}
          </a>
          <div style={{ color: "rgba(240,234,214,0.6)", fontSize: size.text }}>{l.note}</div>
        </div>
      ))}
    </div>
  );
}

/** True once the server says the signed-in user is an admin (the Users card is only for admins). */
function useIsAdmin(userId) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    checkAdmin()
      .then((a) => live && setAdmin(a))
      .catch(() => live && setAdmin(false));
    return () => {
      live = false;
    };
  }, [userId]);
  return admin;
}

/** How many errors are logged for the last 7 days, and when the latest was (read once). */
function useErrorSummary(userId) {
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    let live = true;
    loadErrors(userId)
      .then((rows) => {
        const n = countSince(rows, 7);
        const latest = rows[0] ? ` · latest ${ago(rows[0].at)}` : "";
        live && setText(n ? `${n} in the last 7 days${latest}` : "None in the last 7 days");
      })
      .catch(() => live && setText("Could not read the log"));
    return () => {
      live = false;
    };
  }, [userId]);
  return text;
}

/** The entry that opens the error log. */
function ErrorsEntry({ userId, size }) {
  const [open, setOpen] = useState(false);
  const summary = useErrorSummary(userId);
  return (
    <>
      <button
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "rgba(212,175,55,0.95)",
          fontSize: size.name,
          fontFamily: "inherit",
        }}
      >
        Recent errors
      </button>
      <div style={{ color: "rgba(240,234,214,0.6)", fontSize: size.text }}>{summary}</div>
      {open && <ErrorsModal userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The entry that opens the Users table. */
function UsersEntry({ size }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "rgba(212,175,55,0.95)",
          fontSize: size.name,
          fontFamily: "inherit",
        }}
      >
        User accounts
      </button>
      <div style={{ color: "rgba(240,234,214,0.6)", fontSize: size.text }}>
        Who has an account, with their ids
      </div>
      {open && <UsersModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** The usage table entry, then the link to the Anthropic Console. */
function ClaudeCard({ userId, phone, size }) {
  return (
    <div style={{ display: "grid", gap: "26px" }}>
      <AiUsageCard
        userId={userId}
        phone={phone}
        flush
        asLink
        label="Claude Usage"
        fontSize={size.name}
      />
      <LinkList links={[CLAUDE_LINK]} size={size} />
    </div>
  );
}

function Frame({ title, children }) {
  return (
    <section style={frameStyle} aria-label={title}>
      <div style={frameTitle}>{title}</div>
      {children}
    </section>
  );
}

function Popup({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-label={title} style={popupStyle}>
      <div style={popupHeader}>
        <span>{title}</span>
        <button aria-label="Close" style={closeStyle} onClick={onClose}>
          −
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>{children}</div>
    </div>
  );
}

function Header() {
  return (
    <div className="fade-up" style={{ marginBottom: "8px" }}>
      <div style={eyebrow}>OVERVIEW</div>
      <h2 style={{ ...hdg, fontSize: "34px", marginBottom: 0 }}>Dashboard</h2>
    </div>
  );
}

/** A phone: three rubrics; the one tapped opens as a popup that fills the window. */
function PhoneDashboard({ userId, rows, admin }) {
  const [open, setOpen] = useState(null);
  const close = () => setOpen(null);
  return (
    <div>
      <Header />
      <div style={{ marginTop: "20px" }}>
        {[
          ["apps", "YOUR APPS"],
          ["errors", "ERRORS"],
          ["claude", "CLAUDE"],
          ["infra", "INFRASTRUCTURE"],
          ...(admin ? [["users", "USERS"]] : []),
        ].map(([id, title]) => (
          <button key={id} aria-haspopup="dialog" style={rubricStyle} onClick={() => setOpen(id)}>
            <span>{title}</span>
            <span aria-hidden="true">+</span>
          </button>
        ))}
      </div>
      {open === "apps" && (
        <Popup title="YOUR APPS" onClose={close}>
          <AppRows rows={rows} size={SIZE.popup} />
        </Popup>
      )}
      {open === "infra" && (
        <Popup title="INFRASTRUCTURE" onClose={close}>
          <LinkList links={INFRA_LINKS} size={SIZE.popup} />
        </Popup>
      )}
      {open === "users" && <UsersModal onClose={close} />}
      {open === "errors" && <ErrorsModal userId={userId} onClose={close} />}
      {open === "claude" && (
        <Popup title="CLAUDE" onClose={close}>
          <ClaudeCard userId={userId} phone size={SIZE.popup} />
        </Popup>
      )}
    </div>
  );
}

export default function DashboardPanel({ userId }) {
  const phone = useIsPhone();
  const [rows, setRows] = useState(null);
  const admin = useIsAdmin(userId);
  useEffect(() => {
    let live = true;
    loadDashboard(userId).then((data) => live && setRows(dashboardRows(data)));
    return () => {
      live = false;
    };
  }, [userId]);
  if (phone) return <PhoneDashboard userId={userId} rows={rows} admin={admin} />;
  return (
    <div>
      <Header />
      <div style={gridStyle}>
        <div style={{ display: "grid", gap: "24px", minWidth: 0 }}>
          <Frame title="YOUR APPS">
            <AppRows rows={rows} size={SIZE.box} />
          </Frame>
          <Frame title="ERRORS">
            <ErrorsEntry userId={userId} size={SIZE.box} />
          </Frame>
        </div>
        <div style={{ display: "grid", gap: "24px", minWidth: 0 }}>
          <Frame title="CLAUDE">
            <ClaudeCard userId={userId} phone={false} size={SIZE.box} />
          </Frame>
          {admin && (
            <Frame title="USERS">
              <UsersEntry size={SIZE.box} />
            </Frame>
          )}
        </div>
        <Frame title="INFRASTRUCTURE">
          <LinkList links={INFRA_LINKS} size={SIZE.box} />
        </Frame>
      </div>
    </div>
  );
}
