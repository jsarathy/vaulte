// src/components/ChatHeader.jsx — the chat window's title bar: drag to move, Clear, close.
import { C, FONT, border, IconTrash } from "../constants/design";

const headerStyle = {
  padding: "10px 14px",
  borderBottom: border,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  cursor: "move",
};
const clearStyle = {
  background: "transparent",
  border: `0.5px solid ${C.border}`,
  borderRadius: "4px",
  padding: "2px 8px",
  fontSize: "15px",
  color: C.muted,
  cursor: "pointer",
  fontFamily: FONT.sans,
  display: "flex",
  alignItems: "center",
  gap: "4px",
};
const closeStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: C.muted,
  fontSize: "24px",
  lineHeight: 1,
  padding: "0 2px",
};

export default function ChatHeader({ hasMessages, clearChat, startDrag, close }) {
  return (
    <div onPointerDown={startDrag} title="Drag to move" style={headerStyle}>
      <span style={{ fontWeight: "500", fontSize: "18px", color: C.text }}>
        Nutrition assistant
      </span>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {hasMessages && (
          <button onClick={clearChat} title="Clear history" style={clearStyle}>
            <IconTrash size={15} /> Clear
          </button>
        )}
        <button onClick={close} style={closeStyle}>
          ×
        </button>
      </div>
    </div>
  );
}
