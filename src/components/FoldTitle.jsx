// src/components/FoldTitle.jsx — a card's title. On a phone it is a button that opens and closes
// the card (+ / −); on a desktop it is the plain title it always was.

const BUTTON = {
  background: "none",
  border: "none",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  padding: 0,
  minHeight: "32px",
  justifyContent: "space-between",
};

/** fold: usePhoneFold(). */
export default function FoldTitle({ fold, style, children }) {
  if (!fold.phone) return <div style={style}>{children}</div>;
  const box = { ...style, ...BUTTON, flex: 1 };
  return (
    <button onClick={fold.toggle} aria-expanded={fold.open} style={box}>
      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>{children}</span>
      <span style={{ fontSize: "16px" }}>{fold.open ? "−" : "+"}</span>
    </button>
  );
}
