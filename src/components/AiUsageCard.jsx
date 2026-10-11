// src/components/AiUsageCard.jsx — what the signed-in user's Claude calls used and cost (Fix 84):
// cost for today, 7 and 30 days; a double click opens every call as a table (Fix 85). Sizes and
// costs only.
import { useEffect, useState } from "react";
import { loadMyUsage } from "../api/aiUsage.js";
import { periodCosts, usd } from "../lib/aiUsage.js";
import AiUsageModal from "./AiUsageModal.jsx";

const titleStyle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "12px",
};
const textStyle = { color: "#f0ead6", fontSize: "14px" };
const mutedStyle = { color: "rgba(240,234,214,0.5)", fontSize: "13px" };

export default function AiUsageCard({ userId, phone }) {
  const [state, setState] = useState({ status: "loading" });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    loadMyUsage(userId)
      .then((rows) => live && setState({ status: "ok", rows }))
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, [userId]);

  let body;
  if (state.status === "loading") body = <div style={mutedStyle}>Loading…</div>;
  else if (state.status === "error") body = <div style={mutedStyle}>Could not load usage.</div>;
  else {
    const rows = state.rows;
    const cost = periodCosts(rows);
    body = rows.length ? (
      <>
        <div style={textStyle}>
          Today {usd(cost.day)} · 7 days {usd(cost.week)} · 30 days {usd(cost.month)}
        </div>
        <div style={mutedStyle}>
          {rows.length} calls · {phone ? "double-tap" : "double-click"} for every call
        </div>
      </>
    ) : (
      <div style={mutedStyle}>No Claude calls recorded yet.</div>
    );
  }
  return (
    <div style={{ marginTop: phone ? 0 : "28px" }} className="fade-up-3">
      {!phone && <div style={titleStyle}>CLAUDE USAGE (YOUR ACCOUNT)</div>}
      <div
        className="info-card"
        style={{ flexDirection: "column", alignItems: "stretch", touchAction: "manipulation" }}
        onDoubleClick={() => state.status === "ok" && state.rows.length && setOpen(true)}
      >
        {body}
      </div>
      {open && <AiUsageModal rows={state.rows} onClose={() => setOpen(false)} />}
    </div>
  );
}
