// src/hooks/useTrackerLoad.js — what NutritionTracker loads when it opens, and the return from
// Polar's sign-in (?polar=connected / ?polar=error).
// set = { loading, userRecipes, userRecipesRef, calc, weightPlanConfig, editCfg, weightLog,
//         bodyLog, justChatHistory, chatMessages, polarConnected, polarLastSync, polarSessions,
//         polarSyncMsg, allDays, currentDate, currentDayData, chatDate, compareSlots, compareData }
import { useEffect } from "react";
import { genId, ensureMealSlots } from "../constants/helpers";
import { loadAllRecipes } from "../api/firestore";
import { backfillPortionWeights } from "../api/recipeWeights";
import * as data from "../api/trackerData";
import { POLAR_RETURN, chatMessagesFrom, compareStart } from "../lib/trackerStart.js";

async function loadRecipes(userId, set) {
  const recipes = await loadAllRecipes(userId);
  set.userRecipes(recipes);
  set.userRecipesRef.current = recipes;
  // Fill in an estimated Wt/portion for any saved recipe without one (background)
  backfillPortionWeights(userId, () => set.userRecipesRef.current, set.userRecipes);
}

// Optional: on failure the defaults stay (and later changes are still saved)
async function loadCalculator(userId, calc) {
  try {
    const saved = await data.loadCalculator(userId);
    if (saved) calc.restore(saved);
  } catch (e) {
    console.error("calculator load failed", e);
  } finally {
    calc.markLoaded();
  }
}

async function loadWeight(userId, set) {
  const plan = await data.loadWeightPlan(userId);
  set.weightPlanConfig(plan);
  set.editCfg(plan);
  set.weightLog(await data.loadDatedRows(userId, "weight_log"));
  set.bodyLog(await data.loadDatedRows(userId, "body_log"));
}

// Optional: a failure leaves the chat empty
async function loadChat(userId, set) {
  try {
    const history = await data.loadChatHistory(userId);
    if (!Array.isArray(history) || history.length === 0) return;
    set.justChatHistory(history);
    set.chatMessages(chatMessagesFrom(history, genId));
  } catch (e) {
    console.error("chat history load failed", e);
  }
}

async function loadPolarConnection(userId, set) {
  const conn = await data.loadPolarConnection(userId);
  if (!conn) return;
  set.polarConnected(conn.connected || false);
  set.polarLastSync(conn.last_sync_at || null);
}

async function loadPolarSessions(userId, set) {
  set.polarSessions(await data.loadPolarSessions(userId));
}

// The first day loaded is opened; Compare starts with the first days that have entries
function openFirstDay(days, set) {
  const merged = days.map(ensureMealSlots);
  set.allDays(merged);
  if (merged.length === 0) return;
  set.currentDate(merged[0].date);
  set.currentDayData(merged[0]);
  set.chatDate(merged[0].date);
  const compare = compareStart(merged);
  set.compareSlots(compare.slots);
  set.compareData(compare.data);
}

async function loadTracker(userId, set) {
  try {
    set.loading(true);
    // Independent reads run together, not one after another (Fix 43.3)
    const [days] = await Promise.all([
      data.loadDays(userId),
      loadRecipes(userId, set),
      loadCalculator(userId, set.calc),
      loadWeight(userId, set),
      loadChat(userId, set),
      loadPolarConnection(userId, set),
      loadPolarSessions(userId, set),
    ]);
    openFirstDay(days, set);
  } catch (err) {
    console.error("Init error:", err);
  } finally {
    set.loading(false);
  }
}

// The message shows for 6 s; the query string is removed
function showPolarReturn(userId, set) {
  const status = new URLSearchParams(window.location.search).get("polar");
  if (!POLAR_RETURN.has(status)) return;
  if (status === "connected") loadPolarConnection(userId, set);
  window.history.replaceState({}, "", window.location.pathname);
  set.polarSyncMsg(POLAR_RETURN.get(status));
  setTimeout(() => set.polarSyncMsg(null), 6000);
}

export function useTrackerLoad(userId, set) {
  useEffect(() => {
    if (!userId) return set.loading(false);
    loadTracker(userId, set);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => showPolarReturn(userId, set), [userId]); // eslint-disable-line react-hooks/exhaustive-deps
}
