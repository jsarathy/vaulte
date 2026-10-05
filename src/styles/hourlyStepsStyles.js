// src/styles/hourlyStepsStyles.js — the Steps-by-hour card's inline styles (compact card and full screen)
export const cardStyle = {
  background: "#fff",
  borderRadius: "8px",
  border: "0.5px solid #e5e7eb",
  overflow: "hidden",
  marginTop: "14px",
};
export const cardHeadStyle = {
  background: "#185FA5",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
export const cardTitleStyle = {
  color: "#fff",
  fontWeight: "bold",
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};
export const paneStyle = (total) => ({
  padding: "10px 12px",
  cursor: total ? "zoom-in" : "default",
});

export const fullStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "#fff",
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  cursor: "zoom-out",
};
export const fullHeadStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};
export const fullTitleRowStyle = { display: "flex", alignItems: "center", gap: "16px" };
export const fullTitleStyle = { fontSize: "24px", fontWeight: "bold", color: "#185FA5" };
export const fullHintStyle = { fontSize: "16px", color: "#9ca3af" };
export const fullBoxStyle = { flex: 1, minHeight: 0, overflow: "hidden" };

export const summaryStyle = (full) => ({
  display: "flex",
  justifyContent: "space-between",
  fontSize: full ? "20px" : "11px",
  color: "#6b7280",
  marginBottom: full ? "8px" : "4px",
});
export const loadingStyle = { fontSize: "12px", color: "#9ca3af" };
export const emptyStyle = { fontSize: "12px", color: "#9ca3af", fontStyle: "italic" };

export const browseRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  position: "relative",
};
export const browseDateStyle = (dark) => ({
  color: dark ? "rgba(255,255,255,0.8)" : "#6b7280",
  fontSize: dark ? "11px" : "20px",
});
export const browseButtonStyle = (dark) => ({
  background: dark ? "rgba(255,255,255,0.15)" : "#185FA5",
  border: "none",
  color: "#fff",
  borderRadius: "4px",
  padding: dark ? "3px 8px" : "5px 12px",
  fontSize: dark ? "11px" : "16px",
  cursor: "pointer",
});
export const hiddenPickerStyle = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: "1px",
  height: "1px",
  opacity: 0,
  pointerEvents: "none",
};
