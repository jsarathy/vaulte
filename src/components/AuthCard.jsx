// src/components/AuthCard.jsx — the centred card the Create Account and Sign In pages share:
// background, global CSS, toast, gold lines, wordmark, title and subtitle.
import { bg, cardStyle, globalStyle, hdg, sub } from "../styles/authStyles.js";
import { DecorLines, Toast } from "./AuthBits.jsx";

const wordmark = {
  color: "rgba(212,175,55,0.5)",
  fontFamily: "'Cinzel',serif",
  fontSize: "10px",
  letterSpacing: "3px",
  marginBottom: "4px",
};

export default function AuthCard({ title, subtitle, toast, style, children }) {
  return (
    <div style={{ ...bg, ...style }}>
      <style>{globalStyle}</style>
      <Toast msg={toast} />
      <div style={cardStyle}>
        <DecorLines />
        <div className="fade-up">
          <div style={wordmark}>VAULTE</div>
          <h2 style={hdg}>{title}</h2>
          <p style={sub}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
