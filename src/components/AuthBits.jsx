// src/components/AuthBits.jsx — small pieces shared by the sign-in and account pages: the
// labelled input (with the password eye), a two-column row, the card's gold lines, the error
// box and the toast.
import { useState } from "react";
import { inp, lbl } from "../styles/authStyles.js";

export const EyeIcon = ({ show }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {show ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export const Field = ({ label, type = "text", value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={lbl}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inp, paddingRight: isPassword ? "44px" : "16px" }}
        />
        {isPassword && (
          <button
            onClick={() => setShow((s) => !s)}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(212,175,55,0.5)",
              padding: "0",
              display: "flex",
              alignItems: "center",
            }}
          >
            <EyeIcon show={show} />
          </button>
        )}
      </div>
    </div>
  );
};

export const Row = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>{children}</div>
);

export const DecorLines = () => (
  <>
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent)",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.3),transparent)",
      }}
    />
  </>
);

export const ErrorBox = ({ msg }) =>
  msg ? (
    <div
      style={{
        background: "rgba(180,50,50,0.15)",
        border: "1px solid rgba(180,50,50,0.4)",
        borderRadius: "4px",
        padding: "10px 14px",
        color: "#e07070",
        fontSize: "13px",
        marginBottom: "20px",
        letterSpacing: "0.3px",
      }}
    >
      {msg}
    </div>
  ) : null;

export const Toast = ({ msg }) => (msg ? <div className="toast">* {msg}</div> : null);
