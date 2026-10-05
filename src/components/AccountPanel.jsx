// src/components/AccountPanel.jsx — the My Account panel: header with Edit Profile, the
// profile card, the contact cards and the accounts Vaulte depends on.
import { hdg } from "../styles/authStyles.js";
import ProfileCard from "./ProfileCard.jsx";

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "32px",
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

/** Accounts the Vaulte app depends on. */
function LinkedAccounts() {
  return (
    <div style={{ marginTop: "28px" }} className="fade-up-3">
      <div style={linkedTitleStyle}>ACCOUNTS USED BY VAULTE</div>
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
  return (
    <div>
      <div style={headerStyle} className="fade-up">
        <div>
          <div style={eyebrowStyle}>PROFILE</div>
          <h2 style={{ ...hdg, fontSize: "26px", marginBottom: 0 }}>My Account</h2>
        </div>
        <button className="btn-ghost" onClick={openEdit}>
          Edit Profile
        </button>
      </div>
      <ProfileCard profile={profile} photo={photo} />
      <ContactCards profile={profile} />
      <LinkedAccounts />
    </div>
  );
}
