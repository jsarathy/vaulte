// src/components/AiUsageCard.jsx — what the signed-in user's Claude calls used and cost (Fix 84):
// cost for today, 7 and 30 days, and the last 30 days by feature. Sizes and costs only.
import { useEffect, useState } from "react";
import { loadMyUsage } from "../api/aiUsage.js";
import { periodCosts, summarise, usd } from "../lib/aiUsage.js";

const titleStyle = {
  color: "rgba(212,175,55,0.6)",
  fontSize: "10px",
  letterSpacing: "2px",
  fontFamily: "'Cinzel',serif",
  marginBottom: "12px",
};
const textStyle = { color: "#f0ead6", fontSize: "14px" };
const mutedStyle = { color: "rgba(240,234,214,0.5)", fontSize: "13px" };
const cell = { padding: "4px 10px 4px 0", textAlign: "right", whiteSpace: "nowrap" };
const DAY = 86400000;

function Table({ rows }) {
  return (
    <div style={{ overflowX: "auto", marginTop: "12px" }}>
      <table style={{ ...textStyle, borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={mutedStyle}>
            {["Feature", "Calls", "Avg in", "Avg out", "Avg cost", "Total"].map((h, i) => (
              <th key={h} style={{ ...cell, textAlign: i ? "right" : "left", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key}>
              <td style={{ ...cell, textAlign: "left" }}>{g.key}</td>
              <td style={cell}>{g.calls}</td>
              <td style={cell}>{g.avgInput}</td>
              <td style={cell}>{g.avgOutput}</td>
              <td style={cell}>{usd(g.avgCost)}</td>
              <td style={cell}>{usd(g.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AiUsageCard({ userId, phone }) {
  const [state, setState] = useState({ status: "loading" });
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
    const month = state.rows.filter((r) => r.at >= new Date(Date.now() - 30 * DAY).toISOString());
    const sum = summarise(month);
    const cost = periodCosts(state.rows);
    body = month.length ? (
      <>
        <div style={textStyle}>
          Today {usd(cost.day)} · 7 days {usd(cost.week)} · 30 days {usd(cost.month)}
        </div>
        <div style={mutedStyle}>
          {sum.total.calls} calls, {sum.total.input} tokens in, {sum.total.output} out in the last
          30 days
        </div>
        <Table rows={sum.byFeature} />
      </>
    ) : (
      <div style={mutedStyle}>No Claude calls recorded yet.</div>
    );
  }
  return (
    <div style={{ marginTop: phone ? 0 : "28px" }} className="fade-up-3">
      {!phone && <div style={titleStyle}>CLAUDE USAGE (YOUR ACCOUNT)</div>}
      <div className="info-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
        {body}
      </div>
    </div>
  );
}
