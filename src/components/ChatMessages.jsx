// src/components/ChatMessages.jsx — the conversation: the empty-state note, the history count,
// and each message as the user's, an error, a food preview, a logged note or Claude's reply.
import { C } from "../constants/design";
import { asHtml, historyLabel, loggedLabel } from "../lib/chatMessages.js";
import ChatPreview from "./ChatPreview.jsx";

const listStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};
const emptyStyle = {
  background: C.bg,
  border: `0.5px solid ${C.border}`,
  borderRadius: "6px",
  padding: "10px 12px",
  textAlign: "center",
  fontSize: "16px",
  color: C.muted,
  marginTop: "8px",
  lineHeight: 1.6,
};
const countStyle = {
  textAlign: "center",
  fontSize: "15px",
  color: C.hint,
  padding: "2px 0 2px",
};
const userStyle = {
  background: C.blue,
  color: "#fff",
  alignSelf: "flex-end",
  borderRadius: "10px 10px 3px 10px",
  padding: "7px 11px",
  fontSize: "18px",
  lineHeight: 1.5,
  maxWidth: "82%",
};
const errorStyle = {
  background: C.dangerBg,
  color: C.danger,
  alignSelf: "center",
  border: `0.5px solid #f09595`,
  fontSize: "16px",
  borderRadius: "6px",
  padding: "7px 11px",
};
const loggedStyle = {
  alignSelf: "flex-start",
  fontSize: "16px",
  color: C.greenText,
  fontWeight: "500",
};
const replyStyle = {
  background: C.bg,
  color: C.text,
  alignSelf: "flex-start",
  border: `0.5px solid ${C.border}`,
  borderRadius: "10px 10px 10px 3px",
  padding: "8px 11px",
  fontSize: "18px",
  lineHeight: 1.6,
  maxWidth: "88%",
};

function Message({ msg, discard, confirmLog }) {
  if (msg.type === "user") return <div style={userStyle}>{msg.text}</div>;
  if (msg.type === "error") return <div style={errorStyle}>{msg.text}</div>;
  if (msg.type === "preview" && !msg.confirmed)
    return <ChatPreview msg={msg} discard={discard} confirmLog={confirmLog} />;
  if (msg.type === "preview") return <div style={loggedStyle}>{loggedLabel(msg.items)}</div>;
  return <div style={replyStyle} dangerouslySetInnerHTML={{ __html: asHtml(msg.text) }} />;
}

function EmptyNote() {
  return (
    <div style={emptyStyle}>
      <div style={{ fontWeight: "500", color: C.text, marginBottom: "4px" }}>Chat mode</div>
      Ask nutrition questions, or switch to a meal slot above to log food by description.
    </div>
  );
}

export default function ChatMessages({ chat, bottomRef }) {
  const { chatMessages, setChatMessages, justChatHistory, CHAT_CONTEXT_LIMIT, confirmLog } = chat;
  const discard = (id) => setChatMessages((prev) => prev.filter((m) => m.id !== id));
  return (
    <div style={listStyle}>
      {chatMessages.length === 0 && <EmptyNote />}
      {chatMessages.length > 0 && (
        <div style={countStyle}>{historyLabel(justChatHistory.length, CHAT_CONTEXT_LIMIT)}</div>
      )}
      {chatMessages.map((msg) => (
        <Message key={msg.id} msg={msg} discard={discard} confirmLog={confirmLog} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
