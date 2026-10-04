// src/hooks/useWeightActions.js — Weight and Body tab actions: plan save, Renpho sync, purge,
// and adding a body row from the calendar.
// ctx = { userId, weightLog, setWeightLog, bodyLog, setBodyLog, weightPlanConfig,
//         setWeightPlanConfig, setEditCfg, setEditingPlan }
import { useState } from "react";
import * as api from "../api/trackerActions";
import {
  renphoRows,
  renphoSyncedText,
  rowsBefore,
  withBodyRow,
  withRows,
  withoutRowsBefore,
} from "../lib/weightSync.js";

// The screen takes the new plan at once; a failed save is only logged
async function savePlan(ctx, cfg) {
  ctx.setWeightPlanConfig(cfg);
  ctx.setEditCfg(cfg);
  ctx.setEditingPlan(false);
  try {
    await api.saveWeightPlan(ctx.userId, cfg);
  } catch (e) {
    console.error("weight plan save failed", e);
  }
}

// Clicking a calendar date on the Body tab adds an empty row for it (once)
async function addBodyRow(ctx, date) {
  if (!ctx.userId || ctx.bodyLog.some((r) => r.date === date)) return;
  const row = { date };
  try {
    await api.createBodyRow(ctx.userId, row);
  } catch (e) {
    return console.error("body row create failed", e);
  }
  ctx.setBodyLog((prev) => withBodyRow(prev, row));
}

async function renphoMessage(ctx) {
  const plan = ctx.weightPlanConfig;
  const data = await api.requestRenphoSync(
    ctx.userId,
    plan?.syncFromDate || plan?.startDate || null,
  );
  const records = data.records || [];
  if (records.length === 0) return { ok: true, text: data.warning || "No measurements found." };
  const rows = renphoRows(ctx.weightLog, records);
  await api.saveWeightRows(ctx.userId, rows);
  ctx.setWeightLog(withRows(ctx.weightLog, rows));
  return { ok: true, text: renphoSyncedText(data, rows.length) };
}

// The result shows for 6 s
async function syncRenpho(ctx, state) {
  if (state.syncing || !ctx.userId) return;
  state.setSyncing(true);
  state.setMsg(null);
  state.setMsg(await renphoMessage(ctx).catch((err) => ({ ok: false, text: err.message })));
  state.setSyncing(false);
  setTimeout(() => state.setMsg(null), 6000);
}

// Deletes every logged record dated before the cutoff
async function purgeBefore(ctx, cutoff) {
  if (!ctx.userId || !cutoff) return { deleted: 0 };
  const doomed = rowsBefore(ctx.weightLog, cutoff);
  if (!doomed.length) return { deleted: 0 };
  await api.deleteWeightRows(ctx.userId, doomed);
  ctx.setWeightLog((prev) => withoutRowsBefore(prev, cutoff));
  return { deleted: doomed.length };
}

export function useWeightActions(ctx) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);
  return {
    renphoSyncing: syncing,
    renphoMsg: msg,
    syncRenpho: () => syncRenpho(ctx, { syncing, setSyncing, setMsg }),
    purgeBefore: (cutoff) => purgeBefore(ctx, cutoff),
    savePlanConfig: (cfg) => savePlan(ctx, cfg),
    addBodyRow: (date) => addBodyRow(ctx, date),
  };
}
