// src/components/AccountSidebar.jsx — the signed-in page's navigation and Delete Account.
import { HomeIcon, PersonIcon, PlateIcon } from "./NavIcons.jsx";

const sidebarStyle = {
  width: "300px",
  flexShrink: 0,
  borderRight: "1px solid rgba(212,175,55,0.1)",
  padding: "32px 0",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};
const sectionStyle = {
  padding: "0 18px 16px",
  color: "rgba(212,175,55,0.3)",
  fontSize: "11px",
  letterSpacing: "3px",
  fontFamily: "'Cinzel',serif",
};
const deleteStyle = {
  marginTop: "auto",
  padding: "24px 16px 0",
  borderTop: "1px solid rgba(212,175,55,0.1)",
};
const navStyle = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  padding: "14px 18px",
  background: active ? "rgba(212,175,55,0.12)" : "transparent",
  border: "none",
  borderLeft: active ? "2px solid #ffcf3f" : "2px solid transparent",
  color: active ? "#ffcf3f" : "#ffffff",
  fontFamily: "'Cinzel',serif",
  fontSize: "26px",
  letterSpacing: "1px",
  cursor: "pointer",
  transition: "all 0.25s",
  textTransform: "uppercase",
  textAlign: "left",
});

function NavItem({ id, label, icon, activePanel, setActivePanel }) {
  return (
    <button onClick={() => setActivePanel(id)} style={navStyle(activePanel === id)}>
      <span style={{ fontSize: "26px", display: "flex" }}>{icon}</span>
      <span className="sidebar-label">{label}</span>
    </button>
  );
}

export default function AccountSidebar({ activePanel, setActivePanel, handleDeleteAccount }) {
  const nav = { activePanel, setActivePanel };
  return (
    <div className="app-sidebar" style={sidebarStyle}>
      <div className="sidebar-nav-section" style={sectionStyle}>
        NAVIGATION
      </div>
      <NavItem id="home" label="Home" icon={<HomeIcon />} {...nav} />
      <NavItem id="account" label="My Account" icon={<PersonIcon />} {...nav} />
      <NavItem id="nutrition" label="Nutrition" icon={<PlateIcon />} {...nav} />
      <div className="sidebar-delete" style={deleteStyle}>
        <button
          className="btn-danger"
          style={{ width: "100%", padding: "10px", fontSize: "10px" }}
          onClick={handleDeleteAccount}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
