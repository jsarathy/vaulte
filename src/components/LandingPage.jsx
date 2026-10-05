// src/components/LandingPage.jsx — the welcome page with Create Account / Sign In.
import { bg, globalStyle } from "../styles/authStyles.js";
import { Toast } from "./AuthBits.jsx";

const eyebrow = {
  color: "rgba(212,175,55,0.5)",
  fontFamily: "'Cinzel',serif",
  fontSize: "11px",
  letterSpacing: "4px",
  marginBottom: "8px",
};
const title = {
  fontFamily: "'Cinzel',serif",
  fontSize: "56px",
  color: "#d4af37",
  fontWeight: "400",
  letterSpacing: "8px",
  lineHeight: "1",
  marginBottom: "16px",
};
const tagline = {
  color: "rgba(240,234,214,0.4)",
  fontSize: "16px",
  fontStyle: "italic",
  marginBottom: "52px",
  letterSpacing: "1px",
};

export default function LandingPage({ toast, go }) {
  return (
    <div style={bg}>
      <style>{globalStyle}</style>
      <Toast msg={toast} />
      <div style={{ textAlign: "center" }} className="fade-up">
        <div style={eyebrow}>WELCOME TO</div>
        <h1 style={title}>VAULTE</h1>
        <p style={tagline}>Your personal account, secured.</p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <button
            className="btn-primary"
            style={{ width: "auto", padding: "14px 44px" }}
            onClick={() => go("signup")}
          >
            Create Account
          </button>
          <button className="btn-ghost" onClick={() => go("login")}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
