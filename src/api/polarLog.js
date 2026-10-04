// src/api/polarLog.js — mark a Polar session as logged (users/{uid}/polar_sessions/{id}).
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export const markSessionLogged = (userId, session) =>
  setDoc(doc(db, "users", userId, "polar_sessions", session.id), { ...session, logged: true });
