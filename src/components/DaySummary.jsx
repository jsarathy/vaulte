// src/components/DaySummary.jsx — the Daily log's row of four summary cards.
import { C, FONT } from "../constants/design.jsx";

const GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: "7px",
  marginBottom: "12px",
};
const CARD = {
  background: "#fff",
  border: `0.5px solid ${C.border}`,
  borderRadius: "8px",
  padding: "10px 12px",
};
const LABEL = {
  fontSize: "10px",
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: C.hint,
  marginBottom: "4px",
};
const VALUE = {
  fontFamily: FONT.mono,
  fontSize: "18px",
  fontWeight: "500",
  color: C.text,
  letterSpacing: "-0.5px",
};

/** cards: [{ label, value, note, warn }] from summaryCards. */
export default function DaySummary({ cards }) {
  return (
    <div style={GRID}>
      {cards.map(({ label, value, note, warn }) => (
        <div key={label} style={CARD}>
          <div style={LABEL}>{label}</div>
          <div style={VALUE}>{value}</div>
          <div
            style={{
              fontSize: "10px",
              color: warn ? C.amberText : C.hint,
              marginTop: "2px",
              fontFamily: FONT.mono,
            }}
          >
            {note}
          </div>
        </div>
      ))}
    </div>
  );
}
