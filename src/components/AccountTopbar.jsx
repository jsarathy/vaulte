// src/components/AccountTopbar.jsx — the signed-in page's top bar: wordmark, name, Sign Out.

const barStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 32px",
  borderBottom: "1px solid rgba(212,175,55,0.1)",
  background: "rgba(0,0,0,0.2)",
  flexShrink: 0,
};
const wordmark = {
  fontFamily: "'Cinzel',serif",
  color: "#d4af37",
  fontSize: "20px",
  letterSpacing: "6px",
};
const nameStyle = {
  fontFamily: "'Cinzel',serif",
  color: "rgba(212,175,55,0.5)",
  fontSize: "10px",
  letterSpacing: "2px",
};

export default function AccountTopbar({ profile, handleLogout }) {
  return (
    <div className="app-topbar" style={barStyle}>
      <div style={wordmark}>VAULTE</div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div className="app-topbar-name" style={nameStyle}>
          {profile.firstName} {profile.lastName}
        </div>
        <button
          className="btn-ghost"
          style={{ padding: "8px 20px", fontSize: "10px" }}
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
