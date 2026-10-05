// src/components/ChatPreview.jsx — a food preview in the chat: the items Claude found with
// their nutrition, totals, and Discard / Log to the meal.
import { C, FONT } from "../constants/design";
import { PREVIEW_COLUMNS, cellText, itemValues, previewTotals } from "../lib/chatMessages.js";

const cardStyle = {
  background: "#fff",
  border: `0.5px solid ${C.border}`,
  alignSelf: "flex-start",
  borderRadius: "10px 10px 10px 3px",
  padding: "9px 11px",
  fontSize: "18px",
  maxWidth: "96%",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "15px",
  minWidth: "400px",
};
const headStyle = (h) => ({
  color: C.hint,
  padding: "3px 5px",
  textAlign: h === "Item" ? "left" : "right",
  fontWeight: "500",
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  fontFamily: FONT.sans,
});
const nameStyle = {
  padding: "3px 5px",
  maxWidth: "200px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: C.text,
};
const valueStyle = {
  padding: "3px 5px",
  textAlign: "right",
  color: C.muted,
  fontFamily: FONT.mono,
};
const totalLabelStyle = {
  padding: "3px 5px",
  fontWeight: "500",
  color: C.text,
  fontSize: "15px",
};
const totalStyle = {
  padding: "3px 5px",
  textAlign: "right",
  fontWeight: "500",
  color: C.text,
  fontFamily: FONT.mono,
};
const actionsStyle = {
  display: "flex",
  gap: "6px",
  marginTop: "8px",
  justifyContent: "flex-end",
};
const discardStyle = {
  background: "transparent",
  border: `0.5px solid ${C.borderMid}`,
  color: C.muted,
  borderRadius: "4px",
  padding: "4px 10px",
  fontSize: "16px",
  cursor: "pointer",
  fontFamily: FONT.sans,
};
const logStyle = {
  background: C.blue,
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  padding: "4px 10px",
  fontSize: "16px",
  cursor: "pointer",
  fontFamily: FONT.sans,
  fontWeight: "500",
};

function PreviewRow({ item }) {
  return (
    <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
      <td style={nameStyle}>{item.name}</td>
      {itemValues(item).map((v, j) => (
        <td key={j} style={valueStyle}>
          {cellText(v, j)}
        </td>
      ))}
    </tr>
  );
}

function PreviewTable({ items }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: C.bg }}>
            {PREVIEW_COLUMNS.map((h) => (
              <th key={h} style={headStyle(h)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <PreviewRow key={i} item={item} />
          ))}
          <tr style={{ background: C.bg }}>
            <td style={totalLabelStyle}>Total</td>
            {previewTotals(items).map((v, i) => (
              <td key={i} style={totalStyle}>
                {cellText(v, i)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function ChatPreview({ msg, discard, confirmLog }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "15px", color: C.muted, marginBottom: "6px" }}>
        Adding to <strong style={{ color: C.text }}>{msg.mealName}</strong>
      </div>
      <PreviewTable items={msg.items} />
      <div style={actionsStyle}>
        <button onClick={() => discard(msg.id)} style={discardStyle}>
          Discard
        </button>
        <button onClick={() => confirmLog(msg.id)} style={logStyle}>
          Log to {msg.mealName}
        </button>
      </div>
    </div>
  );
}
