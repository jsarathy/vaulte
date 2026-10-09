// src/components/PillButton.jsx — a rounded pill button (the Weight tab's phone row). Render only.
const PILL = {
  background: "#fff",
  border: "0.5px solid #cfe0f0",
  borderRadius: "999px",
  color: "#185FA5",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
  minHeight: "40px",
  padding: "6px 14px",
};

export default function PillButton({ onClick, children }) {
  return (
    <button onClick={onClick} style={PILL}>
      {children}
    </button>
  );
}
