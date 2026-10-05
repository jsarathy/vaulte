// src/components/ChatWindow.jsx — the floating chat window: resize handles on every edge and
// corner, the header, the day / meal bar, the messages and the input.
import { C, FONT } from "../constants/design";
import { HANDLES } from "../lib/chatWindow.js";
import ChatHeader from "./ChatHeader.jsx";
import ChatContextBar from "./ChatContextBar.jsx";
import ChatMessages from "./ChatMessages.jsx";
import ChatInput from "./ChatInput.jsx";

const frameStyle = ({ pos, size }) => ({
  position: "fixed",
  left: `${pos.x}px`,
  top: `${pos.y}px`,
  width: `${size.w}px`,
  height: `${size.h}px`,
  zIndex: 2500,
  background: "#fff",
  borderRadius: "10px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
  border: `0.5px solid ${C.border}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  fontFamily: FONT.sans,
});

function ResizeHandles({ startResize }) {
  return HANDLES.map(([dx, dy, box, cursor], i) => (
    <div
      key={i}
      onPointerDown={startResize(dx, dy)}
      title="Drag to resize"
      style={{ position: "absolute", ...box, cursor, zIndex: dx && dy ? 3 : 2 }}
    />
  ));
}

export default function ChatWindow({ chat, win, bottomRef }) {
  return (
    <div style={frameStyle(win)}>
      <ResizeHandles startResize={win.startResize} />
      <ChatHeader
        hasMessages={chat.chatMessages.length > 0}
        clearChat={chat.clearChat}
        startDrag={win.startDrag}
        close={() => chat.setChatOpen(false)}
      />
      <ChatContextBar chat={chat} />
      <ChatMessages chat={chat} bottomRef={bottomRef} />
      <ChatInput chat={chat} />
    </div>
  );
}
