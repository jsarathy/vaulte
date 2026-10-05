// src/components/ChatPopup.jsx — the chat: a bubble in the panel's corner and, while open, the
// floating window portalled to <body> (the app sits inside an animated, transformed wrapper, which
// would otherwise make "fixed" relative to that wrapper and push the window off the display).
import { useRef } from "react";
import { createPortal } from "react-dom";
import { useChatWindow } from "../hooks/useChatWindow.js";
import ChatBubble from "./ChatBubble.jsx";
import ChatWindow from "./ChatWindow.jsx";

export default function ChatPopup(chat) {
  const { chatOpen, setChatOpen } = chat;
  const chatBottomRef = useRef(null);
  const win = useChatWindow(chatOpen);
  return (
    <div
      ref={win.wrapRef}
      style={{ position: "absolute", bottom: "16px", right: "16px", zIndex: 500 }}
    >
      {chatOpen &&
        win.pos &&
        createPortal(<ChatWindow chat={chat} win={win} bottomRef={chatBottomRef} />, document.body)}
      <ChatBubble chatOpen={chatOpen} setChatOpen={setChatOpen} />
    </div>
  );
}
