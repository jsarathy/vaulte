// src/styles/appleActivityStyles.js — the Apple Watch Activity card's inline styles
import { C, FONT } from "../constants/design.jsx";

export const cardStyle = {
  background: "#fff",
  border: `0.5px solid ${C.border}`,
  borderRadius: "8px",
  marginBottom: "8px",
  overflow: "hidden",
};
export const headStyle = (collapsed, onToggle) => ({
  padding: "8px 10px 8px 8px",
  cursor: onToggle ? "pointer" : "default",
  background: collapsed ? "#fff" : C.bg,
  borderBottom: collapsed ? "none" : `0.5px solid ${C.border}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});
export const titleRowStyle = { display: "flex", alignItems: "center", gap: "6px" };
export const chevronStyle = (collapsed) => ({
  flexShrink: 0,
  transition: "transform 0.18s",
  transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
});
export const titleStyle = { fontSize: "12px", fontWeight: "500", color: C.blueText };
export const statusRowStyle = { display: "flex", alignItems: "center", gap: "10px" };
export const statusStyle = { fontSize: "10px", color: C.hint, fontFamily: FONT.mono };
export const summaryStyle = (hasData) => ({
  fontSize: "11px",
  fontFamily: FONT.mono,
  fontWeight: hasData ? "500" : "400",
  color: hasData ? C.blueText : C.border,
});
export const emptyStyle = {
  padding: "10px 12px",
  fontSize: "12px",
  color: C.hint,
  fontStyle: "italic",
};

export const tableStyle = { width: "100%", borderCollapse: "collapse" };
export const thStyle = (i) => ({
  color: C.hint,
  fontSize: "10px",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  padding: "5px 10px",
  textAlign: i ? "right" : "left",
  borderBottom: `0.5px solid ${C.border}`,
});
export const cell = {
  padding: "7px 10px",
  fontSize: "12px",
  borderBottom: `0.5px solid ${C.border}`,
};
export const num = { ...cell, textAlign: "right", fontFamily: FONT.mono, fontSize: "11px" };
export const totalRowStyle = { background: C.bg };
export const noteStyle = {
  padding: "6px 10px",
  fontSize: "10px",
  color: C.hint,
  borderTop: `0.5px solid ${C.border}`,
  fontFamily: FONT.mono,
};
