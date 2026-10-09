// src/hooks/useTrackerLoad.js — what NutritionTracker loads when it opens, and the return from
// Polar's sign-in (?polar=connected / ?polar=error).
// The first screen waits only for the newest days, the recipes and the calculator (Fix 43.3);
// everything else loads right after it shows.
// set = { loading, userRecipes, userRecipesRef, calc, weightPlanConfig, editCfg, weightLog,
//         bodyLog, justChatHistory, chatMessages, polarConnected, polarLastSync, polarSessions,
//         polarSyncMsg, allDays, currentDate, currentDayData, chatDate, compareSlots, compareData,
//         daysComplete }
import { useEffect } from "react";
import { genId, ensureMealSlots } from "../constants/helpers";
import { loadAllRecipes } from "../api/firestore";
import { backfillPortionWeights } from "../api/recipeWeights";
import * as data from "../api/trackerData";
import { POLAR_RETURN, chatMessagesFrom, compareStart } from "../lib/trackerStart.js";
import { mergeDays, mergeRows, keepIfTouched } from "../lib/trackerStart.js";

async function loadRecipes(userId, set) {
  const recipes = await loadAllRecipes(userId);
  set.userRecipes(recipes);
  set.userRecipesRef.current = recipes;
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

// Rows already on screen (the person may have saved one meanwhile) win over the stored ones
async function loadWeight(userId, set) {
  const plan = await data.loadWeightPlan(userId);
  set.weightPlanConfig(plan);
  set.editCfg(plan);
  const [weight, body] = await Promise.all([
    data.loadDatedRows(userId, "weight_log"),
    data.loadDatedRows(userId, "body_log"),
  ]);
  set.weightLog((shown) => mergeRows(shown, weight));
  set.bodyLog((shown) => mergeRows(shown, body));
}

async function loadChat(userId, set) {
  const history = await data.loadChatHistory(userId);
  if (!Array.isArray(history) || history.length === 0) return;
  set.justChatHistory(history);
  set.chatMessages(chatMessagesFrom(history, genId));
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
  if (merged.length === 0) return merged;
  set.currentDate(merged[0].date);
  set.currentDayData(merged[0]);
  set.chatDate(merged[0].date);
  const compare = compareStart(merged);
  set.compareSlots(compare.slots);
  set.compareData(compare.data);
  return merged;
}

// Every stored day joins the ones on screen; Compare, if untouched, picks its days again
async function loadEarlierDays(userId, firstDays, set) {
  try {
    await mergeEarlierDays(userId, firstDays, set);
  } finally {
    set.daysComplete(true); // the sidebar's 7-day average and streak need every day
  }
}

async function mergeEarlierDays(userId, firstDays, set) {
  const all = (await data.loadEveryDay(userId)).map(ensureMealSlots);
  set.allDays((shown) => mergeDays(shown, all));
  const first = compareStart(firstDays).slots;
  const next = compareStart(mergeDays(firstDays, all));
  if (next.slots.filter(Boolean).length <= first.filter(Boolean).length) return;
  set.compareSlots((now) => keepIfTouched(now, first, next.slots));
  set.compareData((now) => keepIfTouched(now, first, next.data));
}

// Each of these is optional: a failure is logged and the rest carry on
const later = (name, job) => job.catch((e) => console.error(`${name} load failed`, e));

function loadRest(userId, firstDays, set) {
  const reads = [
    later("earlier days", loadEarlierDays(userId, firstDays, set)),
    later("weight", loadWeight(userId, set)),
    later("chat history", loadChat(userId, set)),
    later("polar connection", loadPolarConnection(userId, set)),
    later("polar sessions", loadPolarSessions(userId, set)),
  ];
  // Fill in an estimated Wt/portion for any saved recipe without one, once the rest is in
  Promise.all(reads).then(() =>
    backfillPortionWeights(userId, () => set.userRecipesRef.current, set.userRecipes),
  );
}

async function loadTracker(userId, set) {
  let days = [];
  try {
    set.loading(true);
    const first = await Promise.all([
      data.loadFirstDays(userId),
      loadRecipes(userId, set),
      loadCalculator(userId, set.calc),
    ]);
    days = openFirstDay(first[0], set);
  } catch (err) {
    console.error("Init error:", err);
  } finally {
    set.loading(false);
  }
  loadRest(userId, days, set);
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
