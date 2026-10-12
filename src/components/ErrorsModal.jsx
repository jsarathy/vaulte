// src/components/ErrorsModal.jsx — the app error log as a table (Dashboard, Fix 98 part 2): when,
// what kind, which page, the message; newest first; searchable. Same look as the Claude usage and
// Users tables. Esc, ✕ or a tap outside closes it.
import { useEffect, useState } from "react";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { loadErrors } from "../api/errorLog.js";
import { ERROR_COLUMNS, errorCells, errorsCount, filterErrors } from "../lib/errorLog.js";
import { S, TYPE } from "./tableStyles.js";

const WRAP = { whiteSpace: "normal", wordBreak: "break-word", minWidth: "24ch", maxWidth: "60ch" };

function Rows({ entries, pad }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
      <thead>
        <tr>
          {ERROR_COLUMNS.map((h) => (
            <th key={h} style={{ ...S.th, padding: pad, textAlign: "center" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i}>
            {errorCells(e).map((text, c) => (
              <td key={c} style={{ ...S.td, padding: pad, ...(c === 3 && WRAP) }}>
                {text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Body({ state, shown, pad }) {
  if (state.status === "loading") return <div style={S.note}>Loading…</div>;
  if (state.status === "error") return <div style={S.note}>Could not load the error log.</div>;
  if (!shown.length)
    return (
      <div style={S.note}>{state.entries.length ? "No errors match." : "No errors recorded."}</div>
    );
  return <Rows entries={shown} pad={pad} />;
}

export default function ErrorsModal({ userId, onClose }) {
  const type = TYPE[useIsPhone() ? "phone" : "monitor"];
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ status: "loading", entries: [] });
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    loadErrors(userId)
      .then((entries) => live && setState({ status: "ok", entries }))
      .catch(() => live && setState({ status: "error", entries: [] }));
    return () => {
      live = false;
    };
  }, [userId]);
  const shown = filterErrors(state.entries, query);
  return (
    <div style={S.backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-label="Errors"
        style={{ ...S.box, fontSize: type.base }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...S.bar, fontSize: type.bar }}>
          <span style={{ flex: 1 }}>ERRORS</span>
          <button aria-label="Close" style={S.close} onClick={onClose}>
            ✕
          </button>
          <div style={{ ...S.filters, fontSize: type.control }}>
            <input
              type="search"
              aria-label="Search errors"
              placeholder="Search errors"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...S.select, fontSize: type.control, flex: 1, minWidth: 0 }}
            />
          </div>
        </div>
        <div style={S.scroll}>
          <Body state={state} shown={shown} pad={type.pad} />
        </div>
        <div style={{ ...S.total, fontSize: type.total }}>{errorsCount(shown.length)}</div>
      </div>
    </div>
  );
}
