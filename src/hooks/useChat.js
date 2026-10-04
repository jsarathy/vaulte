// src/hooks/useChat.js — the Claude chat's actions: ask a question, or (with a meal chosen)
// turn a description into food entries to log; clear the conversation.
// ctx = tracker state (chat, days, recipes) + userId + persistDay
import { genId, makeMeals } from "../constants/helpers";
import { loadDay } from "../api/firestore";
import { claudeChat, claudeParseFood } from "../api/claude";
import { writeChatHistory } from "../api/chatHistory";
import { withItemsInMeal } from "../lib/dayMeals.js";
import { chatMealName, lastMessages, withMessage } from "../lib/chatLog.js";

async function saveHistory(userId, history) {
  if (!userId) return;
  try {
    await writeChatHistory(userId, history);
  } catch (e) {
    console.error("chat history save failed", e);
  }
}

async function askClaude(ctx, text, thinkId) {
  const asked = [...ctx.justChatHistory, { role: "user", content: text }];
  const reply = await claudeChat(lastMessages(asked), ctx.userRecipes);
  const kept = lastMessages([...asked, { role: "assistant", content: reply }]);
  ctx.setJustChatHistory(kept);
  await saveHistory(ctx.userId, kept);
  ctx.setChatMessages((prev) => withMessage(prev, thinkId, { text: reply }));
}

async function previewFood(ctx, text, thinkId) {
  const items = await claudeParseFood(text);
  const preview = { type: "preview", items, mealId: ctx.chatMealId, confirmed: false };
  const mealName = chatMealName(ctx);
  ctx.setChatMessages((prev) => withMessage(prev, thinkId, { ...preview, mealName }));
}

// One question at a time; "…" shows until the reply (or the error) replaces it
async function sendChat(ctx) {
  const text = ctx.chatInput.trim();
  if (!text || ctx.chatLoading) return;
  ctx.setChatInput("");
  ctx.setChatLoading(true);
  const asked = { id: genId(), type: "user", text };
  const think = { id: genId(), type: "claude", text: "…" };
  ctx.setChatMessages((prev) => [...prev, asked, think]);
  try {
    await (ctx.chatMealId === "__chat__" ? askClaude : previewFood)(ctx, text, think.id);
  } catch (err) {
    ctx.setChatMessages((prev) =>
      withMessage(prev, think.id, { type: "error", text: err.message }),
    );
  }
  ctx.setChatLoading(false);
}

// The chat's day: the open day if it is that day, else as stored, else new
async function chatDay(ctx) {
  const open = ctx.currentDayData;
  if (open && open.date === ctx.chatDate) return open;
  const stored = await loadDay(ctx.userId, ctx.chatDate);
  return stored || { date: ctx.chatDate, notes: "", meals: makeMeals() };
}

async function confirmLog(ctx, msgId) {
  const msg = ctx.chatMessages.find((m) => m.id === msgId);
  if (!msg) return;
  const day = await chatDay(ctx);
  const items = msg.items.map((i) => ({ ...i, id: genId() }));
  await ctx.persistDay(withItemsInMeal(day, msg.mealId, items));
  ctx.setChatMessages((prev) => withMessage(prev, msgId, { confirmed: true }));
}

async function clearChat(ctx) {
  ctx.setJustChatHistory([]);
  ctx.setChatMessages([]);
  if (!ctx.userId) return;
  try {
    await writeChatHistory(ctx.userId, []);
  } catch (e) {
    console.error("chat history clear failed", e);
  }
}

export const useChat = (ctx) => ({
  sendChat: () => sendChat(ctx),
  confirmLog: (msgId) => confirmLog(ctx, msgId),
  clearChat: () => clearChat(ctx),
});
