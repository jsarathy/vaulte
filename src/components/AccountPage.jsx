// src/components/AccountPage.jsx — the signed-in page: top bar, sidebar and the open panel
// (Home, My Account or Nutrition), plus the Edit Profile overlay and the toast.
import NutritionTracker from "../NutritionTracker";
import { globalStyle } from "../styles/authStyles.js";
import { Toast } from "./AuthBits.jsx";
import AccountTopbar from "./AccountTopbar.jsx";
import AccountSidebar from "./AccountSidebar.jsx";
import EditProfileModal from "./EditProfileModal.jsx";
import HomePanel from "./HomePanel.jsx";
import AccountPanel from "./AccountPanel.jsx";

const pageStyle = {
  height: "100vh",
  background: "radial-gradient(ellipse at 20% 50%,#1a1508 0%,#0d0d0f 60%,#080810 100%)",
  display: "flex",
  flexDirection: "column",
  fontFamily: "'Cormorant Garamond',serif",
  overflow: "hidden",
};
const mainStyle = (activePanel) => ({
  flex: 1,
  padding: activePanel === "home" ? "0" : "48px",
  overflowY: activePanel === "home" ? "hidden" : "auto",
  position: "relative",
});

function Panel({ activePanel, profile, userId, account }) {
  if (activePanel === "home") return <HomePanel profile={profile} />;
  if (activePanel === "nutrition")
    return (
      <div className="fade-up" style={{ margin: "-24px" }}>
        <NutritionTracker userId={userId} />
      </div>
    );
  return <AccountPanel profile={profile} {...account} />;
}

export default function AccountPage({ profile, toast, userId, page, nav, edit }) {
  return (
    <div style={pageStyle}>
      <style>{globalStyle}</style>
      <Toast msg={toast} />
      {edit.editing && <EditProfileModal {...edit} />}
      <AccountTopbar profile={profile} handleLogout={page.handleLogout} />
      <div
        className="app-body"
        style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        <AccountSidebar {...nav} handleDeleteAccount={page.handleDeleteAccount} />
        <div className="app-main" style={mainStyle(nav.activePanel)}>
          <Panel
            activePanel={nav.activePanel}
            profile={profile}
            userId={userId}
            account={page.account}
          />
        </div>
      </div>
    </div>
  );
}
