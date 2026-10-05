// src/components/ChatInput.jsx — the message box (Enter sends, Shift+Enter breaks a line) and
// the send button.
import { C, FONT, border, IconSend } from "../constants/design";
import { placeholderFor } from "../lib/chatMessages.js";

const rowStyle = {
  padding: "8px 10px",
  borderTop: border,
  display: "flex",
  gap: "6px",
  flexShrink: 0,
  background: "#fff",
};
const textStyle = {
  flex: 1,
  padding: "7px 9px",
  border: `0.5px solid ${C.borderMid}`,
  borderRadius: "6px",
  fontSize: "18px",
  resize: "none",
  height: "66px",
  fontFamily: FONT.sans,
  outline: "none",
  color: C.text,
  background: C.bg,
};
const sendStyle = (busy) => ({
  background: busy ? C.hint : C.blue,
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "0 12px",
  cursor: busy ? "not-allowed" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "stretch",
});

export default function ChatInput({ chat }) {
  const { chatInput, setChatInput, chatMealId, chatLoading, sendChat } = chat;
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };
  return (
    <div style={rowStyle}>
      <textarea
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholderFor(chatMealId)}
        style={textStyle}
      />
      <button onClick={sendChat} disabled={chatLoading} style={sendStyle(chatLoading)}>
        <IconSend size={19} />
      </button>
    </div>
  );
}
