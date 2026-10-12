// src/components/tableStyles.js — the look shared by the table dialogs (Claude usage, Users): the
// frame, title bar, bordered cells with centred headings, and the type sizes for a monitor and a phone.

export const CELL_BORDER = "1px solid rgba(212,175,55,0.22)";
const gold = "rgba(212,175,55,0.8)";
export const S = {
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

/** Type sizes: the table, the title bar, and the filter controls (16 px or more on a phone, so it does not zoom). */
export const TYPE = {
  phone: { base: "16px", bar: "15px", control: "16px", pad: "6px 8px", total: "19px" },
  monitor: { base: "19px", bar: "20px", control: "17px", pad: "8px 14px", total: "21px" },
};
