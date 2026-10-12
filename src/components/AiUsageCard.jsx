// src/components/AiUsageCard.jsx — the Claude usage entry on My Account (Fix 84, 85, 86): a double
// click (double tap on a phone) opens the table of calls, which loads its own data.
import { useState } from "react";
import AiUsageModal from "./AiUsageModal.jsx";

const titleStyle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "12px",
};
const mutedStyle = { color: "rgba(240,234,214,0.5)", fontSize: "13px" };

export default function AiUsageCard({ userId, phone }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: phone ? 0 : "28px" }} className="fade-up-3">
      {!phone && <div style={titleStyle}>CLAUDE USAGE (YOUR ACCOUNT)</div>}
      <div
        className="info-card"
        style={{ flexDirection: "column", alignItems: "stretch", touchAction: "manipulation" }}
        onDoubleClick={() => setOpen(true)}
      >
        <div style={mutedStyle}>
          {phone ? "Double-tap" : "Double-click"} here to see every Claude call and its cost
        </div>
      </div>
      {open && <AiUsageModal userId={userId} onClose={() => setOpen(false)} />}
    </div>
  );
}
