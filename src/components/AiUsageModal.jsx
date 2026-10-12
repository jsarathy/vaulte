// src/components/AiUsageModal.jsx — the Claude usage table (Fix 85, 86): every recorded call with
// its date, feature, tokens and cost, filtered by period (a query on Firestore) and by feature.
// Takes most of the screen, scrolls both ways; Esc, ✕ or a tap outside closes it.
import { useEffect, useState } from "react";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { loadMyUsage } from "../api/aiUsage.js";
import { PERIODS, periodStart, summarise, cents, whenText } from "../lib/aiUsage.js";

const CELL_BORDER = "1px solid rgba(212,175,55,0.22)";
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
    width: "fit-content",
    minWidth: "min(100%, 520px)",
    maxWidth: "100%",
    height: "94dvh",
    display: "flex",
    flexDirection: "column",
    color: "#f0ead6",
    fontSize: "13px",
  },
  bar: {
    width: 0, // the title bar fills the dialog but does not make it wider than the table
    minWidth: "100%",
    boxSizing: "border-box",
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
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 14px",
    flexBasis: "100%",
    letterSpacing: "1px",
  },
  scroll: { overflow: "auto", flex: 1, WebkitOverflowScrolling: "touch" },
  th: {
    position: "sticky",
    top: 0,
    background: "#14141a",
    color: "rgba(240,234,214,0.8)",
    fontWeight: 600,
    padding: "8px 12px",
    whiteSpace: "nowrap",
    border: CELL_BORDER,
  },
  td: { padding: "6px 12px", whiteSpace: "nowrap", border: CELL_BORDER },
  note: { padding: "24px", textAlign: "center", color: "rgba(240,234,214,0.5)" },
  total: {
    width: 0,
    minWidth: "100%",
    boxSizing: "border-box",
    padding: "10px 16px",
    borderTop: "1px solid rgba(212,175,55,0.2)",
    color: gold,
  },
};
const COLUMNS = ["Date", "Feature", "In", "Out", "Cost"];

function Select({ label, value, onChange, size, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      {label}
      <select
        aria-label={label}
        style={{ ...S.select, fontSize: size }}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
    </label>
  );
}

function Rows({ rows, pad }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
      <thead>
        <tr>
          {COLUMNS.map((h) => (
            <th key={h} style={{ ...S.th, padding: pad, textAlign: "center" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...S.td, padding: pad }}>{whenText(r.at)}</td>
            <td style={{ ...S.td, padding: pad }}>{r.feature || "unknown"}</td>
            <td style={{ ...S.td, padding: pad, textAlign: "right" }}>{r.input_tokens || 0}</td>
            <td style={{ ...S.td, padding: pad, textAlign: "right" }}>{r.output_tokens || 0}</td>
            <td style={{ ...S.td, padding: pad, textAlign: "right" }}>
              {r.cost_usd == null ? "n/a" : cents(r.cost_usd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Body({ state, shown, pad }) {
  if (state.status === "loading") return <div style={S.note}>Loading…</div>;
  if (state.status === "error") return <div style={S.note}>Could not load usage.</div>;
  if (!shown.length) return <div style={S.note}>No Claude calls recorded for this filter.</div>;
  return <Rows rows={shown} pad={pad} />;
}

function Total({ shown, size }) {
  const t = summarise(shown).total;
  return (
    <div style={{ ...S.total, fontSize: size }}>
      {t.calls} calls · {t.input} in · {t.output} out · {cents(t.cost)}
    </div>
  );
}

/** Type sizes: the table, the title bar, and the filter controls (16 px or more on a phone, so it does not zoom). */
const TYPE = {
  phone: { base: "16px", bar: "15px", control: "16px", pad: "6px 8px", total: "19px" },
  monitor: { base: "19px", bar: "20px", control: "17px", pad: "8px 14px", total: "21px" },
};

export default function AiUsageModal({ userId, onClose }) {
  const type = TYPE[useIsPhone() ? "phone" : "monitor"];
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
        style={{ ...S.box, fontSize: type.base }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...S.bar, fontSize: type.bar }}>
          <span style={{ flex: 1 }}>CLAUDE USAGE</span>
          <button aria-label="Close" style={S.close} onClick={onClose}>
            ✕
          </button>
          <div style={{ ...S.filters, fontSize: type.control }}>
            <Select
              label="Period"
              size={type.control}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Select
              label="Feature"
              size={type.control}
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
            >
              <option value="all">All features</option>
              {features.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div style={S.scroll}>
          <Body state={state} shown={shown} pad={type.pad} />
        </div>
        <Total shown={shown} size={type.total} />
      </div>
    </div>
  );
}
