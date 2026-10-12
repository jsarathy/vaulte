// src/components/AiUsageModal.jsx — the Claude usage table (Fix 85, 86): every recorded call with
// its date, feature, tokens and cost, filtered by period (a query on Firestore) and by feature.
// Takes most of the screen, scrolls both ways; Esc, ✕ or a tap outside closes it.
import { useEffect, useState } from "react";
import { loadMyUsage } from "../api/aiUsage.js";
import { PERIODS, periodStart, summarise, usd, whenText } from "../lib/aiUsage.js";

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
    padding: "8px",
  },
  box: {
    background: "#14141a",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: "10px",
    width: "1200px",
    maxWidth: "100%",
    height: "94dvh",
    display: "flex",
    flexDirection: "column",
    color: "#f0ead6",
    fontSize: "13px",
  },
  bar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    padding: "10px 16px",
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
    marginLeft: "auto",
  },
  select: {
    background: "#0d0d0f",
    color: "#f0ead6",
    border: "1px solid rgba(212,175,55,0.35)",
    borderRadius: "6px",
    padding: "6px 8px",
    fontSize: "13px",
    minHeight: "36px",
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
  note: { padding: "24px", textAlign: "center", color: "rgba(240,234,214,0.5)" },
  total: { padding: "10px 16px", borderTop: "1px solid rgba(212,175,55,0.2)", color: gold },
};
const COLUMNS = ["Date", "Feature", "In", "Out", "Cost"];

function Select({ label, value, onChange, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      {label}
      <select aria-label={label} style={S.select} value={value} onChange={onChange}>
        {children}
      </select>
    </label>
  );
}

function Rows({ rows }) {
  return (
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
  );
}

function Body({ state, shown }) {
  if (state.status === "loading") return <div style={S.note}>Loading…</div>;
  if (state.status === "error") return <div style={S.note}>Could not load usage.</div>;
  if (!shown.length) return <div style={S.note}>No Claude calls recorded for this filter.</div>;
  return <Rows rows={shown} />;
}

function Total({ shown }) {
  const t = summarise(shown).total;
  return (
    <div style={S.total}>
      {t.calls} calls · {t.input} in · {t.output} out · {usd(t.cost)}
    </div>
  );
}

export default function AiUsageModal({ userId, onClose }) {
  const [period, setPeriod] = useState("30d");
  const [feature, setFeature] = useState("all");
  const [state, setState] = useState({ status: "loading", rows: [] });
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: "loading" }));
    loadMyUsage(userId, periodStart(period))
      .then((rows) => live && setState({ status: "ok", rows }))
      .catch(() => live && setState({ status: "error", rows: [] }));
    return () => {
      live = false;
    };
  }, [userId, period]);
  const features = [...new Set([feature, ...state.rows.map((r) => r.feature || "unknown")])]
    .filter((f) => f !== "all")
    .sort();
  const shown =
    feature === "all" ? state.rows : state.rows.filter((r) => (r.feature || "unknown") === feature);
  return (
    <div style={S.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-label="Claude usage"
        style={S.box}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={S.bar}>
          <span>CLAUDE USAGE</span>
          <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select label="Feature" value={feature} onChange={(e) => setFeature(e.target.value)}>
            <option value="all">All features</option>
            {features.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <button aria-label="Close" style={S.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={S.scroll}>
          <Body state={state} shown={shown} />
        </div>
        <Total shown={shown} />
      </div>
    </div>
  );
}
