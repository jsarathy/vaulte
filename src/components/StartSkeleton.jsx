// src/components/StartSkeleton.jsx — the grey shapes shown while the tracker's first screen loads
// (Fix 43.3.5). Render only.
import { C, FONT } from "../constants/design.jsx";

const shimmer = "@keyframes vaulte-pulse{0%,100%{opacity:.45}50%{opacity:.9}}";

const block = (width, height) => ({
  width,
  height,
  background: C.border,
  borderRadius: "6px",
  animation: "vaulte-pulse 1.4s ease-in-out infinite",
});

function Rows({ count, height }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} style={{ ...block("100%", height), marginBottom: "10px" }} />
  ));
}

export default function StartSkeleton() {
  return (
    <div data-testid="start-skeleton" style={{ padding: "16px", fontFamily: FONT.sans }}>
      <style>{shimmer}</style>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <div style={block("90px", "28px")} />
        <div style={block("70px", "28px")} />
        <div style={block("90px", "28px")} />
      </div>
      <Rows count={4} height="64px" />
      <div style={{ color: C.muted, textAlign: "center", fontSize: "12px" }}>Loading your log…</div>
    </div>
  );
}
