// src/components/AiUsageCard.jsx — the CLAUDE USAGE heading in the Dashboard's Claude card (Fix 84–87, 98). On a
// computer a double click on it opens the table of calls; on a phone one tap does. The table loads
// its own data. `flush` removes the top margin (inside a box); `fontSize` sets the heading size; `asLink` gives it a link's colour and font; `label` is its text.
import { useState } from "react";
import AiUsageModal from "./AiUsageModal.jsx";

const gold = "rgba(212,175,55,0.6)";
const headingStyle = {
  color: gold,
  fontSize: "15px",
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

/** Looks like a link beside it: the same colour and the page's own font, no capitals styling. */
const AS_LINK = { color: "rgba(212,175,55,0.95)", fontFamily: "inherit", letterSpacing: "normal" };

export default function AiUsageCard({
  userId,
  phone,
  flush = false,
  fontSize,
  asLink = false,
  label = "CLAUDE USAGE",
}) {
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  return (
    <>
      {phone ? (
        <button
          aria-haspopup="dialog"
          style={{
            ...phoneStyle,
            ...(flush && { marginTop: 0 }),
            ...(asLink && AS_LINK),
            ...(fontSize && { fontSize }),
          }}
          onClick={show}
        >
          <span>{label}</span>
          <span>›</span>
        </button>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          title="Double-click to open"
          style={{
            ...headingStyle,
            ...(flush && { marginTop: 0 }),
            ...(asLink && AS_LINK),
            ...(fontSize && { fontSize }),
          }}
          onDoubleClick={show}
          onKeyDown={(e) => e.key === "Enter" && show()}
        >
          {label}
        </div>
      )}
      {open && <AiUsageModal userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}
