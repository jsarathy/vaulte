// src/api/trackerData.js — the Firestore reads NutritionTracker makes when it opens, and the
// reference calculator's save.
import { db } from "../firebase";
import { doc, getDoc, getDocs, collection, setDoc } from "firebase/firestore";
import { loadAllDays, seedInitialData } from "./firestore";
import { DEFAULT_PLAN_CONFIG } from "../constants/weightPlan";
import { calculatorDoc, datedRows, unloggedSessions } from "../lib/trackerStart.js";

const userDoc = (userId, ...path) => doc(db, "users", userId, ...path);
const userDocs = (userId, name) => getDocs(collection(db, "users", userId, name));
const dataOf = async (ref) => {
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

/** The user's days; a new user's are seeded first. */
export async function loadDays(userId) {
  const days = await loadAllDays(userId);
  return days.length === 0 ? seedInitialData(userId) : days;
}

export const loadCalculator = (userId) => dataOf(userDoc(userId, "settings", "calculator"));
export const saveCalculator = (userId, values) =>
  setDoc(userDoc(userId, "settings", "calculator"), calculatorDoc(values, new Date()));

/** The weight plan: saved settings over the defaults. */
export async function loadWeightPlan(userId) {
  const saved = await dataOf(userDoc(userId, "weight_plan", "settings"));
  return saved ? { ...DEFAULT_PLAN_CONFIG, ...saved } : DEFAULT_PLAN_CONFIG;
}

/** weight_log / body_log rows in date order (real measurements only). */
export const loadDatedRows = async (userId, name) => datedRows((await userDocs(userId, name)).docs);

export const loadChatHistory = async (userId) =>
  (await dataOf(userDoc(userId, "claude_chat", "conversation")))?.history;

export const loadPolarConnection = (userId) => dataOf(userDoc(userId, "polar", "connection"));

export const loadPolarSessions = async (userId) =>
  unloggedSessions((await userDocs(userId, "polar_sessions")).docs);
