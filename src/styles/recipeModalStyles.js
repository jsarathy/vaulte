// src/styles/recipeModalStyles.js — the recipe card modal's inline styles
import { C, FONT, border } from "../constants/design";

export const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 5000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: FONT.sans,
};
export const cardStyle = {
  background: "#fff",
  borderRadius: "10px",
  width: "580px",
  maxWidth: "95vw",
  maxHeight: "88dvh",
  overflowY: "auto",
  border: `0.5px solid ${C.border}`,
};
export const headStyle = {
  padding: "14px 18px",
  borderBottom: border,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  position: "sticky",
  top: 0,
  background: "#fff",
  zIndex: 1,
  borderRadius: "10px 10px 0 0",
};
export const nameStyle = { fontSize: "14px", fontWeight: "500", color: C.text };
export const sourceStyle = { fontSize: "11px", color: C.muted, marginTop: "2px" };
export const closeStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: C.muted,
  fontSize: "18px",
  lineHeight: 1,
  marginLeft: "12px",
};
export const bodyStyle = { padding: "16px 18px" };
export const descriptionStyle = {
  color: C.muted,
  fontSize: "12px",
  marginBottom: "12px",
  lineHeight: 1.6,
};
export const tagRowStyle = { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" };
export const tagStyle = {
  background: C.bg,
  border: `0.5px solid ${C.border}`,
  color: C.muted,
  borderRadius: "20px",
  padding: "3px 10px",
  fontSize: "11px",
};
export const sectionStyle = {
  fontSize: "10px",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: C.hint,
  margin: "14px 0 7px",
  paddingBottom: "5px",
  borderBottom: `0.5px solid ${C.border}`,
};
export const nutritionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(6,minmax(0,1fr))",
  gap: "5px",
  marginBottom: "14px",
};
export const nutritionCellStyle = {
  textAlign: "center",
  background: C.bg,
  borderRadius: "5px",
  padding: "7px 4px",
  border: `0.5px solid ${C.border}`,
};
export const nutritionValueStyle = {
  fontFamily: FONT.mono,
  fontWeight: "500",
  color: C.text,
  fontSize: "14px",
};
export const nutritionLabelStyle = {
  fontSize: "9px",
  color: C.hint,
  marginTop: "2px",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};
export const listStyle = { marginBottom: "14px" };
export const ingredientStyle = {
  padding: "6px 0",
  borderBottom: `0.5px solid ${C.border}`,
  display: "flex",
  gap: "12px",
  fontSize: "12px",
};
export const amountStyle = {
  fontWeight: "500",
  color: C.blueText,
  minWidth: "65px",
  fontFamily: FONT.mono,
};
export const itemStyle = { color: C.text };
export const stepsStyle = (hasNotes) => ({ marginBottom: hasNotes ? "14px" : "0" });
export const stepStyle = {
  padding: "7px 0 7px 32px",
  borderBottom: `0.5px solid ${C.border}`,
  fontSize: "12px",
  lineHeight: 1.6,
  position: "relative",
  color: C.text,
};
export const stepBadgeStyle = {
  position: "absolute",
  left: 0,
  top: 7,
  background: C.blue,
  color: "#fff",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "9px",
  fontWeight: "500",
};
export const notesStyle = {
  background: C.amberBg,
  borderLeft: `2px solid ${C.amberText}`,
  padding: "9px 12px",
  borderRadius: "0 4px 4px 0",
  fontSize: "12px",
  lineHeight: 1.5,
  color: C.amberText,
  marginTop: "14px",
};
