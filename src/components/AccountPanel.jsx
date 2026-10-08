// src/components/AccountPanel.jsx — the My Account panel: header with Edit Profile, the
// profile card, the contact cards and the accounts Vaulte depends on.
import { useState } from "react";
import { hdg } from "../styles/authStyles.js";
import { useIsPhone } from "../hooks/useIsPhone.js";
import ProfileCard from "./ProfileCard.jsx";
import { EditIcon } from "./NavIcons.jsx";

const headerStyle = { marginBottom: "32px" };
const titleRowStyle = { display: "flex", alignItems: "center", gap: "14px" };
const editButtonStyle = {
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "20px",
  padding: 0,
  letterSpacing: 0,
  borderRadius: "50%",
};
const eyebrowStyle = {
  color: "rgba(212,175,55,0.4)",
  fontFamily: "'Cinzel',serif",
  fontSize: "10px",
  letterSpacing: "3px",
  marginBottom: "8px",
};
const infoLabelStyle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "5px",
};
const linkedTitleStyle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "12px",
};
const linkedGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
  gap: "10px",
};
const linkedCardStyle = {
  padding: "12px 16px",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
};
const linkStyle = {
  color: "rgba(212,175,55,0.8)",
  fontSize: "11px",
  wordBreak: "break-all",
  textDecoration: "none",
};
const LINKED_ACCOUNTS = [
  { name: "GitHub", url: "https://github.com/jsarathy/vaulte" },
  { name: "Vercel", url: "https://vercel.com/jsarathys-projects/vaulte" },
  {
    name: "Firebase (Google)",
    url: "https://console.firebase.google.com/project/vaulte-1ea20",
  },
  { name: "Anthropic (Claude API)" },
  { name: "Polar", url: "https://flow.polar.com/diary" },
  { name: "Renpho" },
  { name: "Apple Health (iOS Shortcuts)" },
];

function InfoCard({ icon, label, value }) {
  return (
    <div className="info-card">
      <div style={{ fontSize: "20px", marginTop: "2px", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={infoLabelStyle}>{label}</div>
        <div style={{ color: "#f0ead6", fontSize: "15px", letterSpacing: "0.3px" }}>
          {value || (
            <span style={{ color: "rgba(240,234,214,0.25)", fontStyle: "italic" }}>
              Not provided
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactCards({ profile }) {
  const address = [profile.address, profile.city, profile.postcode].filter(Boolean).join(", ");
  return (
    <div style={{ display: "grid", gap: "12px" }} className="fade-up-3">
      <InfoCard icon="@" label="Email Address" value={profile.email} />
      <InfoCard icon="T" label="Telephone" value={profile.phone} />
      <InfoCard icon="A" label="Address" value={address} />
    </div>
  );
}

const sectionButtonStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  minHeight: "48px",
  padding: "0 4px",
  background: "none",
  border: "none",
  borderBottom: "1px solid rgba(212,175,55,0.2)",
  cursor: "pointer",
  color: "rgba(212,175,55,0.8)",
  fontSize: "11px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
};

/** Phone: a heading that opens and closes its content (closed to start with). */
function Collapsible({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "12px" }}>
      <button aria-expanded={open} onClick={() => setOpen(!open)} style={sectionButtonStyle}>
        <span>{title}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ paddingTop: "14px" }}>{children}</div>}
    </div>
  );
}

/** Accounts the Vaulte app depends on. */
function LinkedAccounts({ phone }) {
  return (
    <div style={{ marginTop: phone ? 0 : "28px" }} className="fade-up-3">
      {!phone && <div style={linkedTitleStyle}>ACCOUNTS USED BY VAULTE</div>}
      <div style={linkedGridStyle}>
        {LINKED_ACCOUNTS.map(({ name, url }) => (
          <div key={name} className="info-card" style={linkedCardStyle}>
            <div style={{ color: "#f0ead6", fontSize: "14px", letterSpacing: "0.3px" }}>{name}</div>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {url.replace(/^https:\/\//, "")}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountPanel({ profile, photo, openEdit }) {
  const phone = useIsPhone();
  return (
    <div>
      <div style={headerStyle} className="fade-up">
        <div style={eyebrowStyle}>PROFILE</div>
        <div style={titleRowStyle}>
          <h2 style={{ ...hdg, fontSize: "26px", marginBottom: 0 }}>My Account</h2>
          <button
            className="btn-ghost"
            style={editButtonStyle}
            aria-label="Edit Profile"
            title="Edit Profile"
            onClick={openEdit}
          >
            <EditIcon />
          </button>
        </div>
      </div>
      <ProfileCard profile={profile} photo={photo} />
      {phone ? (
        <>
          <Collapsible title="DETAILS">
            <ContactCards profile={profile} />
          </Collapsible>
          <Collapsible title="CONNECTED SERVICES">
            <LinkedAccounts phone />
          </Collapsible>
        </>
      ) : (
        <>
          <ContactCards profile={profile} />
          <LinkedAccounts />
        </>
      )}
    </div>
  );
}
