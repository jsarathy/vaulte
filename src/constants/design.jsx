// src/constants/design.js — shared design tokens for the Linear-style redesign

export const C = {
  blue:        "#378ADD",
  blueText:    "#185FA5",
  blueBg:      "#E6F1FB",
  blueMid:     "#B5D4F4",
  greenText:   "#3B6D11",
  greenBg:     "#EAF3DE",
  amberText:   "#BA7517",
  amberBg:     "#FAEEDA",
  danger:      "#c62828",
  dangerBg:    "#FCEBEB",
  border:      "#e5e7eb",
  borderMid:   "#d1d5db",
  bg:          "#f9fafb",
  surface:     "#ffffff",
  text:        "#111827",
  muted:       "#6b7280",
  hint:        "#9ca3af",
};

export const FONT = {
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', monospace",
};

// Common inline style helpers
export const border = `0.5px solid ${C.border}`;
export const borderMid = `0.5px solid ${C.borderMid}`;

export const card = {
  background: C.surface,
  border: `0.5px solid ${C.border}`,
  borderRadius: "8px",
};

export const metricCard = {
  ...card,
  padding: "10px 12px",
};

export const label = {
  fontSize: "10px",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: C.hint,
  fontFamily: FONT.sans,
};

export const monoVal = {
  fontFamily: FONT.mono,
  fontWeight: "500",
  letterSpacing: "-0.5px",
};

export const pill = (variant = "blue") => {
  const map = {
    blue:  { background: C.blueBg,   color: C.blueText  },
    green: { background: C.greenBg,  color: C.greenText },
    amber: { background: C.amberBg,  color: C.amberText },
    red:   { background: C.dangerBg, color: C.danger    },
  };
  return {
    ...map[variant],
    fontSize: "10px",
    fontWeight: "500",
    fontFamily: FONT.mono,
    padding: "2px 7px",
    borderRadius: "20px",
    whiteSpace: "nowrap",
  };
};

export const svgBtn = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "2px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: C.hint,
  borderRadius: "3px",
};

// SVG icon helpers (stroke-only, 14px, 1.5 stroke-width)
export const IconX = ({ size = 11, color }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke={color || "currentColor"} strokeWidth="1.5" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8"/>
  </svg>
);

export const IconChevronLeft = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 12L6 8l4-4"/>
  </svg>
);

export const IconChevronRight = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4"/>
  </svg>
);

export const IconPlus = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 3v10M3 8h10"/>
  </svg>
);

export const IconChat = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

export const IconSend = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

export const IconTrash = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h10M6 4V3h4v1M5 4v8h6V4"/>
  </svg>
);

export const IconBike = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
    <path d="M15 6a1 1 0 0 0-1-1h-1l-3 9h6.5M5.5 17.5l4.5-11"/>
  </svg>
);

export const IconClock = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5"/>
  </svg>
);
