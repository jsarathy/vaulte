// src/components/AiUsageModal.jsx — every recorded Claude call as a table: date, feature, tokens
// in and out, cost (Fix 85). Fits the screen width and scrolls both ways; Esc, ✕ or a tap outside
// closes it.
import { useEffect } from "react";
import { usd, whenText } from "../lib/aiUsage.js";

const gold = "rgba(212,175,55,0.8)";
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  box: {
    background: "#14141a",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: "10px",
    width: "720px",
    maxWidth: "100%",
    maxHeight: "88dvh",
    display: "flex",
    flexDirection: "column",
    color: "#f0ead6",
    fontSize: "13px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(212,175,55,0.2)",
    fontFamily: "'Cinzel',serif",
    fontSize: "11px",
    letterSpacing: "2px",
    color: gold,
  },
  close: {
    background: "none",
    border: "none",
    color: gold,
    fontSize: "20px",
    cursor: "pointer",
    minWidth: "44px",
    minHeight: "44px",
  },
  scroll: { overflow: "auto", flex: 1, WebkitOverflowScrolling: "touch" },
  th: {
    position: "sticky",
    top: 0,
    background: "#14141a",
    color: "rgba(240,234,214,0.55)",
    fontWeight: 400,
    padding: "8px 12px",
    whiteSpace: "nowrap",
  },
  td: { padding: "6px 12px", whiteSpace: "nowrap" },
};
const COLUMNS = ["Date", "Feature", "In", "Out", "Cost"];

export default function AiUsageModal({ rows, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={S.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-label="Claude usage"
        style={S.box}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.header}>
          <span>CLAUDE USAGE · {rows.length} CALLS</span>
          <button aria-label="Close" style={S.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={S.scroll}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {COLUMNS.map((h, i) => (
                  <th key={h} style={{ ...S.th, textAlign: i > 1 ? "right" : "left" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={S.td}>{whenText(r.at)}</td>
                  <td style={S.td}>{r.feature || "unknown"}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>{r.input_tokens || 0}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>{r.output_tokens || 0}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>
                    {r.cost_usd == null ? "n/a" : usd(r.cost_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
