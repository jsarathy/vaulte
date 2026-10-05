// src/components/ChatBubble.jsx — the round button that opens and closes the chat.
import { C, IconChat } from "../constants/design";

const bubbleStyle = (open) => ({
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  background: open ? "#fff" : C.blue,
  color: open ? C.blue : "#fff",
  border: `0.5px solid ${open ? C.blue : C.blue}`,
  boxShadow: "0 2px 12px rgba(55,138,221,0.3)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s",
});

const IconClose = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export default function ChatBubble({ chatOpen, setChatOpen }) {
  return (
    <button
      onClick={() => setChatOpen((o) => !o)}
      title="Nutrition assistant"
      style={bubbleStyle(chatOpen)}
    >
      {chatOpen ? <IconClose /> : <IconChat size={18} />}
    </button>
  );
}
