// src/components/PhonePopup.jsx — a pop-up over the page on a phone: title, Close, and a body that
// scrolls. A tap on the backdrop closes it. Drawn on the page body so it covers the whole screen,
// top bar included. Render only.
import { createPortal } from "react-dom";
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1500,
    padding: "12px",
  },
  sheet: {
    background: "#fff",
    borderRadius: "10px",
    width: "100%",
    maxHeight: "calc(100dvh - 24px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "0.5px solid #e5e7eb",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#185FA5",
  },
  close: {
    background: "none",
    border: "0.5px solid #e5e7eb",
    borderRadius: "6px",
    cursor: "pointer",
    minHeight: "40px",
    padding: "4px 12px",
    fontSize: "12px",
  },
  body: { overflow: "auto", padding: "10px" },
};

export default function PhonePopup({ title, onClose, children }) {
  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div role="dialog" aria-label={title} style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.bar}>
          <span>{title}</span>
          <button onClick={onClose} style={S.close}>
            Close
          </button>
        </div>
        <div style={S.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
