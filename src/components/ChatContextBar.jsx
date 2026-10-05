// src/components/ChatContextBar.jsx — the day and the meal (or Chat mode) the chat works on.
import { C, FONT, border } from "../constants/design";
import { CHAT_MODE, mealsForDate } from "../lib/chatMessages.js";

const barStyle = {
  padding: "6px 10px",
  background: C.bg,
  borderBottom: border,
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "16px",
  flexShrink: 0,
};
const dateStyle = {
  fontSize: "16px",
  fontWeight: "500",
  color: C.text,
  border: `0.5px solid ${C.borderMid}`,
  borderRadius: "4px",
  padding: "2px 6px",
  fontFamily: FONT.mono,
  outline: "none",
  background: "#fff",
};
const selectStyle = {
  flex: 1,
  padding: "3px 6px",
  border: `0.5px solid ${C.borderMid}`,
  borderRadius: "4px",
  fontSize: "16px",
  fontFamily: FONT.sans,
  background: "#fff",
  outline: "none",
};

export default function ChatContextBar({ chat }) {
  const { chatDate, setChatDate, chatMealId, setChatMealId, allDays, currentDayData } = chat;
  return (
    <div style={barStyle}>
      <input
        type="date"
        value={chatDate}
        onChange={(e) => setChatDate(e.target.value)}
        style={dateStyle}
      />
      <select
        value={chatMealId}
        onChange={(e) => setChatMealId(e.target.value)}
        style={selectStyle}
      >
        <option value={CHAT_MODE}>Chat mode</option>
        {mealsForDate(allDays, chatDate, currentDayData).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
