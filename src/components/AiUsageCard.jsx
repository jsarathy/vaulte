// src/components/AiUsageCard.jsx — the CLAUDE USAGE heading on My Account (Fix 84–87). On a
// computer a double click on it opens the table of calls; on a phone one tap does. The table loads
// its own data. `flush` removes the top margin (inside a box); `fontSize` sets the heading size.
import { useState } from "react";
import AiUsageModal from "./AiUsageModal.jsx";

const gold = "rgba(212,175,55,0.6)";
const headingStyle = {
  color: gold,
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginTop: "28px",
  display: "inline-block",
  cursor: "pointer",
  userSelect: "none",
  touchAction: "manipulation",
};
const phoneStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  minHeight: "48px",
  marginTop: "12px",
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

export default function AiUsageCard({ userId, phone, flush = false, fontSize }) {
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  return (
    <>
      {phone ? (
        <button
          aria-haspopup="dialog"
          style={flush ? { ...phoneStyle, marginTop: 0 } : phoneStyle}
          onClick={show}
        >
          <span>CLAUDE USAGE</span>
          <span>›</span>
        </button>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          title="Double-click to open"
          style={{ ...headingStyle, ...(flush && { marginTop: 0 }), ...(fontSize && { fontSize }) }}
          onDoubleClick={show}
          onKeyDown={(e) => e.key === "Enter" && show()}
        >
          CLAUDE USAGE
        </div>
      )}
      {open && <AiUsageModal userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
