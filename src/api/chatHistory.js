// src/api/chatHistory.js — the saved chat conversation (users/{uid}/claude_chat/conversation).
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export const writeChatHistory = (userId, history) =>
  setDoc(doc(db, "users", userId, "claude_chat", "conversation"), {
    history,
    updatedAt: new Date().toISOString(),
  });
