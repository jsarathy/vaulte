// src/styles/compareStyles.js — the Compare tab's inline styles (day columns, reference calculator)
import { C, FONT } from "../constants/design";

export const frameStyle = { flex: 1, display: "flex", overflow: "hidden" };
export const daysPaneStyle = { flex: 1, overflowY: "auto", padding: "14px 16px" };
export const daysTitleStyle = {
  fontSize: "17px",
  fontWeight: "600",
  color: C.text,
  marginBottom: "3px",
};
export const daysHintStyle = { fontSize: "13px", color: C.muted };
export const daysGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5,minmax(0,1fr))",
  gap: "7px",
};

export const columnStyle = {
  background: "#fff",
  border: `0.5px solid ${C.border}`,
  borderRadius: "8px",
  overflow: "hidden",
};
export const columnHeadStyle = {
  padding: "7px 8px",
  cursor: "pointer",
  background: C.bg,
  borderBottom: `0.5px solid ${C.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
export const columnDateStyle = { fontSize: "13px", fontWeight: "500", color: C.text };
export const columnBodyStyle = { padding: "8px 10px" };
export const noDayStyle = {
  textAlign: "center",
  color: C.border,
  fontSize: "18px",
  fontWeight: "500",
  padding: "8px 0 2px",
  fontFamily: FONT.mono,
};
export const kcalStyle = {
  fontFamily: FONT.mono,
  fontSize: "23px",
  fontWeight: "500",
  color: C.text,
  textAlign: "center",
  padding: "6px 0 1px",
  letterSpacing: "-0.5px",
};
export const kcalLabelStyle = {
  fontSize: "12px",
  color: C.hint,
  textAlign: "center",
  marginBottom: "8px",
};
export const macroRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "4px 0",
  borderBottom: `0.5px solid ${C.border}`,
  fontSize: "13px",
};
export const macroNameStyle = { color: C.hint };
export const macroValueStyle = { fontWeight: "500", color: C.text, fontFamily: FONT.mono };

export const calcPaneStyle = {
  width: "290px",
  flexShrink: 0,
  background: "#fff",
  borderLeft: `0.5px solid ${C.border}`,
  overflowY: "auto",
  padding: "14px",
};
export const calcTitleStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: C.text,
  marginBottom: "12px",
  paddingBottom: "8px",
  borderBottom: `0.5px solid ${C.border}`,
};
export const calcGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "7px",
  marginBottom: "8px",
};
export const inputStyle = {
  width: "100%",
  padding: "5px 8px",
  border: `0.5px solid ${C.borderMid}`,
  borderRadius: "5px",
  fontSize: "14px",
  fontFamily: FONT.sans,
  outline: "none",
  background: "#fff",
  height: "34px",
};
export const labelStyle = {
  fontSize: "11px",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  color: C.hint,
  marginBottom: "4px",
  display: "block",
};
export const bmrStyle = {
  textAlign: "center",
  fontSize: "13px",
  color: C.muted,
  marginBottom: "10px",
};
export const bmrValueStyle = { fontFamily: FONT.mono, fontWeight: "500", color: C.text };
export const levelsStyle = { display: "flex", flexDirection: "column", gap: "5px" };
export const levelStyle = (first) => ({
  border: `0.5px solid ${first ? C.blue : C.border}`,
  borderRadius: "6px",
  padding: "7px 9px",
  background: first ? C.blueBg : "#fff",
});
export const levelHeadStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: "2px",
};
export const levelNameStyle = (first) => ({
  fontSize: "13px",
  fontWeight: "500",
  color: first ? C.blueText : C.text,
});
export const levelKcalStyle = (first) => ({
  fontFamily: FONT.mono,
  fontSize: "14px",
  fontWeight: "500",
  color: first ? C.blue : C.text,
});
export const levelDescStyle = { fontSize: "12px", color: C.hint };
export const levelMacrosStyle = {
  fontSize: "12px",
  color: C.muted,
  fontFamily: FONT.mono,
  marginTop: "3px",
};
