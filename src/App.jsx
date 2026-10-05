import { useState } from "react";
import NutritionTracker from "./NutritionTracker";
import { auth, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { deleteAccount, saveProfile, updateAccount } from "./api/authAccount.js";
import { useAuthPages } from "./hooks/useAuthPages.js";
import { bg, cardStyle, globalStyle, hdg } from "./styles/authStyles.js";
import { DecorLines, ErrorBox, Field, Row } from "./components/AuthBits.jsx";
import LandingPage from "./components/LandingPage.jsx";
import SignupPage from "./components/SignupPage.jsx";
import LoginPage from "./components/LoginPage.jsx";

// Main App
export default function App() {
  const pages = useAuthPages();
  const { page, profile, setProfile, error, setError, toast, showToast, loading, go } = pages;
  const { signupData, setSignupData, handleSignup, handleGoogleSignIn, handleLogout } = pages;
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [activePanel, setActivePanel] = useState("home");

  const openEdit = () => {
    setEditData({ ...profile });
    setEditing(true);
  };
  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      setProfile(await updateAccount(profile, editData));
      showToast("PROFILE UPDATED");
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setSavingEdit(false);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      await deleteAccount();
      setProfile(null);
      go("landing");
    } catch (e) {
      alert("Error deleting account: " + e.message);
    }
  };

  if (page === "loading")
    return (
      <div style={{ ...bg, flexDirection: "column", gap: "16px" }}>
        <style>{globalStyle}</style>
        <div
          style={{
            fontFamily: "'Cinzel',serif",
            color: "#d4af37",
            fontSize: "32px",
            letterSpacing: "8px",
          }}
        >
          VAULTE
        </div>
        <span className="spinner-gold" />
      </div>
    );

  if (page === "landing") return <LandingPage toast={toast} go={go} />;

  if (page === "signup")
    return (
      <SignupPage
        toast={toast}
        error={error}
        signupData={signupData}
        setSignupData={setSignupData}
        actions={{ loading, handleSignup, handleGoogleSignIn, go }}
      />
    );

  if (page === "login")
    return (
      <LoginPage
        toast={toast}
        error={error}
        loading={loading}
        login={pages.login}
        handleGoogleSignIn={handleGoogleSignIn}
        go={go}
      />
    );

  if (page === "account" && profile) {
    const InfoCard = ({ icon, label, value }) => (
      <div className="info-card">
        <div style={{ fontSize: "20px", marginTop: "2px", flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: "rgba(212,175,55,0.6)",
              fontSize: "10px",
              letterSpacing: "2px",
              fontFamily: "'Cinzel',serif",
              marginBottom: "5px",
            }}
          >
            {label}
          </div>
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

    const navItem = (id, label, icon) => (
      <button
        onClick={() => setActivePanel(id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          padding: "14px 18px",
          background: activePanel === id ? "rgba(212,175,55,0.12)" : "transparent",
          border: "none",
          borderLeft: activePanel === id ? "2px solid #ffcf3f" : "2px solid transparent",
          color: activePanel === id ? "#ffcf3f" : "#ffffff",
          fontFamily: "'Cinzel',serif",
          fontSize: "26px",
          letterSpacing: "1px",
          cursor: "pointer",
          transition: "all 0.25s",
          textTransform: "uppercase",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: "26px" }}>{icon}</span>
        <span className="sidebar-label">{label}</span>
      </button>
    );

    return (
      <div
        style={{
          height: "100vh",
          background: "radial-gradient(ellipse at 20% 50%,#1a1508 0%,#0d0d0f 60%,#080810 100%)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Cormorant Garamond',serif",
          overflow: "hidden",
        }}
      >
        <style>{globalStyle}</style>
        {toast && <div className="toast">* {toast}</div>}

        {editing && (
          <div
            className="overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditing(false);
            }}
          >
            <div
              style={{ ...cardStyle, maxWidth: "520px", maxHeight: "90vh", overflowY: "auto" }}
              className="modal-in"
            >
              <DecorLines />
              <div style={{ marginBottom: "28px" }}>
                <h2 style={{ ...hdg, fontSize: "22px", marginBottom: "4px" }}>Edit Profile</h2>
                <p
                  style={{ color: "rgba(240,234,214,0.4)", fontSize: "13px", fontStyle: "italic" }}
                >
                  Update your personal information
                </p>
              </div>
              <ErrorBox msg={error} />
              <Row>
                <Field
                  label="First Name"
                  value={editData.firstName || ""}
                  onChange={(v) => setEditData({ ...editData, firstName: v })}
                  placeholder="Jane"
                />
                <Field
                  label="Last Name"
                  value={editData.lastName || ""}
                  onChange={(v) => setEditData({ ...editData, lastName: v })}
                  placeholder="Smith"
                />
              </Row>
              <Field
                label="Phone Number"
                value={editData.phone || ""}
                onChange={(v) => setEditData({ ...editData, phone: v })}
                placeholder="+44 7700 000000"
              />
              <Field
                label="Street Address"
                value={editData.address || ""}
                onChange={(v) => setEditData({ ...editData, address: v })}
                placeholder="123 High Street"
              />
              <Row>
                <Field
                  label="City"
                  value={editData.city || ""}
                  onChange={(v) => setEditData({ ...editData, city: v })}
                  placeholder="London"
                />
                <Field
                  label="Postcode"
                  value={editData.postcode || ""}
                  onChange={(v) => setEditData({ ...editData, postcode: v })}
                  placeholder="SW1A 1AA"
                />
              </Row>
              <Field
                label="New Password (optional)"
                type="password"
                value={editData.password || ""}
                onChange={(v) => setEditData({ ...editData, password: v })}
                placeholder="Leave blank to keep current"
              />
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button className="btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit && <span className="spinner" />}Save Changes
                </button>
                <button
                  className="btn-ghost"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          className="app-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 32px",
            borderBottom: "1px solid rgba(212,175,55,0.1)",
            background: "rgba(0,0,0,0.2)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "'Cinzel',serif",
              color: "#d4af37",
              fontSize: "20px",
              letterSpacing: "6px",
            }}
          >
            VAULTE
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              className="app-topbar-name"
              style={{
                fontFamily: "'Cinzel',serif",
                color: "rgba(212,175,55,0.5)",
                fontSize: "10px",
                letterSpacing: "2px",
              }}
            >
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

        <div
          className="app-body"
          style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <div
            className="app-sidebar"
            style={{
              width: "300px",
              flexShrink: 0,
              borderRight: "1px solid rgba(212,175,55,0.1)",
              padding: "32px 0",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              className="sidebar-nav-section"
              style={{
                padding: "0 18px 16px",
                color: "rgba(212,175,55,0.3)",
                fontSize: "11px",
                letterSpacing: "3px",
                fontFamily: "'Cinzel',serif",
              }}
            >
              NAVIGATION
            </div>
            {navItem("home", "Home", "~")}
            {navItem("account", "My Account", "*")}
            {navItem("nutrition", "Nutrition", "N")}
            <div
              className="sidebar-delete"
              style={{
                marginTop: "auto",
                padding: "24px 16px 0",
                borderTop: "1px solid rgba(212,175,55,0.1)",
              }}
            >
              <button
                className="btn-danger"
                style={{ width: "100%", padding: "10px", fontSize: "10px" }}
                onClick={handleDeleteAccount}
              >
                Delete Account
              </button>
            </div>
          </div>

          <div
            className="app-main"
            style={{
              flex: 1,
              padding: activePanel === "home" ? "0" : "48px",
              overflowY: activePanel === "home" ? "hidden" : "auto",
              position: "relative",
            }}
          >
            {activePanel === "home" && (
              <div
                className="fade-up"
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  background: "linear-gradient(160deg,#0d0d0f 60%,#1a1408)",
                }}
              >
                {profile.photoURL && (
                  <div
                    style={{
                      position: "absolute",
                      top: "32px",
                      right: "32px",
                      width: "2in",
                      height: "2in",
                      backgroundImage: `url(${profile.photoURL})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      borderRadius: "8px",
                      border: "1px solid rgba(212,175,55,0.3)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    padding: "56px 56px 48px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      color: "rgba(212,175,55,0.5)",
                      fontFamily: "'Cinzel',serif",
                      fontSize: "10px",
                      letterSpacing: "4px",
                      marginBottom: "20px",
                      textTransform: "uppercase",
                    }}
                  >
                    {new Date().toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <h1
                    style={{
                      fontFamily: "'Cinzel',serif",
                      color: "#d4af37",
                      fontSize: "52px",
                      fontWeight: "400",
                      letterSpacing: "4px",
                      lineHeight: "1.1",
                      marginBottom: "16px",
                      textShadow: "0 4px 24px rgba(0,0,0,0.8)",
                    }}
                  >
                    Welcome, {profile.firstName}.
                  </h1>
                  <p
                    style={{
                      color: "rgba(240,234,214,0.45)",
                      fontSize: "15px",
                      fontStyle: "italic",
                      letterSpacing: "1px",
                      textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                    }}
                  >
                    Good to have you back.
                  </p>
                </div>
              </div>
            )}

            {activePanel === "nutrition" && (
              <div className="fade-up" style={{ margin: "-24px" }}>
                <NutritionTracker userId={auth.currentUser?.uid} />
              </div>
            )}

            {activePanel === "account" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "32px",
                  }}
                  className="fade-up"
                >
                  <div>
                    <div
                      style={{
                        color: "rgba(212,175,55,0.4)",
                        fontFamily: "'Cinzel',serif",
                        fontSize: "10px",
                        letterSpacing: "3px",
                        marginBottom: "8px",
                      }}
                    >
                      PROFILE
                    </div>
                    <h2 style={{ ...hdg, fontSize: "26px", marginBottom: 0 }}>My Account</h2>
                  </div>
                  <button className="btn-ghost" onClick={openEdit}>
                    Edit Profile
                  </button>
                </div>

                <div
                  style={{
                    padding: "24px 28px",
                    background:
                      "linear-gradient(135deg,rgba(212,175,55,0.1),rgba(212,175,55,0.03))",
                    border: "1px solid rgba(212,175,55,0.25)",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                  }}
                  className="fade-up-2"
                >
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#c9a84c,#b8962e)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Cinzel',serif",
                      fontSize: "20px",
                      color: "#0d0d0f",
                      fontWeight: "600",
                      flexShrink: 0,
                    }}
                  >
                    {profile.firstName?.[0]}
                    {profile.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "'Cinzel',serif",
                        color: "#d4af37",
                        fontSize: "18px",
                        letterSpacing: "2px",
                      }}
                    >
                      {profile.firstName} {profile.lastName}
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "rgba(212,175,55,0.1)",
                        border: "1px solid rgba(212,175,55,0.25)",
                        borderRadius: "20px",
                        padding: "3px 10px",
                        margin: "6px 0",
                      }}
                    >
                      <span style={{ color: "rgba(212,175,55,0.5)", fontSize: "9px" }}>+</span>
                      <span
                        style={{
                          fontFamily: "'Cinzel',serif",
                          fontSize: "9px",
                          letterSpacing: "2px",
                          color: "rgba(212,175,55,0.7)",
                        }}
                      >
                        {profile.uid}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "rgba(240,234,214,0.4)",
                        fontSize: "13px",
                        fontStyle: "italic",
                      }}
                    >
                      Member since {profile.createdAt}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "center" }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="photo-upload"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        try {
                          const uid = auth.currentUser?.uid;
                          if (!uid) {
                            alert("Not logged in");
                            return;
                          }
                          showToast("UPLOADING...");
                          const storageRef = ref(storage, "profile-photos/" + uid + ".jpg");
                          await uploadBytes(storageRef, file);
                          const downloadURL = await getDownloadURL(storageRef);
                          const updated = { ...profile, photoURL: downloadURL };
                          await saveProfile(uid, updated);
                          setProfile(updated);
                          showToast("PHOTO UPDATED");
                        } catch (err) {
                          console.error("Photo upload error:", err);
                          alert("Could not upload photo: " + err.message);
                        }
                      }}
                    />
                    <label htmlFor="photo-upload" style={{ cursor: "pointer", display: "block" }}>
                      {profile.photoURL ? (
                        <div
                          style={{
                            width: "200px",
                            height: "200px",
                            borderRadius: "12px",
                            backgroundImage: `url(${profile.photoURL})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            border: "2px solid rgba(212,175,55,0.4)",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "200px",
                            height: "200px",
                            borderRadius: "12px",
                            border: "2px dashed rgba(212,175,55,0.3)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            transition: "border-color 0.3s",
                            background: "rgba(212,175,55,0.03)",
                          }}
                        >
                          <span style={{ fontSize: "40px" }}>[ photo ]</span>
                          <span
                            style={{
                              fontFamily: "'Cinzel',serif",
                              fontSize: "9px",
                              letterSpacing: "1px",
                              color: "rgba(212,175,55,0.4)",
                              textAlign: "center",
                            }}
                          >
                            CLICK TO
                            <br />
                            ADD PHOTO
                          </span>
                        </div>
                      )}
                    </label>
                    {profile.photoURL && (
                      <button
                        onClick={async () => {
                          try {
                            const storageRef = ref(
                              storage,
                              "profile-photos/" + auth.currentUser.uid + ".jpg",
                            );
                            await deleteObject(storageRef).catch(() => {});
                            const u = { ...profile };
                            delete u.photoURL;
                            await saveProfile(auth.currentUser.uid, u);
                            setProfile(u);
                            showToast("PHOTO REMOVED");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        style={{
                          marginTop: "8px",
                          background: "none",
                          border: "none",
                          color: "rgba(200,80,80,0.5)",
                          fontFamily: "'Cinzel',serif",
                          fontSize: "9px",
                          letterSpacing: "1px",
                          cursor: "pointer",
                          textTransform: "uppercase",
                        }}
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gap: "12px" }} className="fade-up-3">
                  <InfoCard icon="@" label="Email Address" value={profile.email} />
                  <InfoCard icon="T" label="Telephone" value={profile.phone} />
                  <InfoCard
                    icon="A"
                    label="Address"
                    value={[profile.address, profile.city, profile.postcode]
                      .filter(Boolean)
                      .join(", ")}
                  />
                </div>

                {/* Accounts the Vaulte app depends on */}
                <div style={{ marginTop: "28px" }} className="fade-up-3">
                  <div
                    style={{
                      color: "rgba(212,175,55,0.6)",
                      fontSize: "10px",
                      letterSpacing: "2px",
                      fontFamily: "'Cinzel',serif",
                      marginBottom: "12px",
                    }}
                  >
                    ACCOUNTS USED BY VAULTE
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
                      gap: "10px",
                    }}
                  >
                    {[
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
                    ].map(({ name, url }) => (
                      <div
                        key={name}
                        className="info-card"
                        style={{
                          padding: "12px 16px",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "4px",
                        }}
                      >
                        <div style={{ color: "#f0ead6", fontSize: "14px", letterSpacing: "0.3px" }}>
                          {name}
                        </div>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "rgba(212,175,55,0.8)",
                              fontSize: "11px",
                              wordBreak: "break-all",
                              textDecoration: "none",
                            }}
                          >
                            {url.replace(/^https:\/\//, "")}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
