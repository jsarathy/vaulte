// src/hooks/usePolarSync.js — Sync on the Polar card: pull new sessions from Polar.
// ctx = { userId, setPolarSessions, setPolarSyncMsg, setPolarLastSync }
import { useState } from "react";
import { requestPolarSync } from "../api/trackerActions";
import { polarSyncedText, withSyncedSessions } from "../lib/weightSync.js";

// Success shows for 5 s, failure for 6 s
async function syncPolar(ctx, setSyncing) {
  setSyncing(true);
  ctx.setPolarSyncMsg(null);
  try {
    const data = await requestPolarSync(ctx.userId);
    if (data.newSessions === 0) ctx.setPolarSyncMsg({ ok: true, text: "All up to date." });
    else {
      ctx.setPolarSessions((prev) => withSyncedSessions(prev, data.sessions));
      ctx.setPolarSyncMsg({ ok: true, text: polarSyncedText(data.newSessions) });
    }
    ctx.setPolarLastSync(new Date().toISOString());
    setTimeout(() => ctx.setPolarSyncMsg(null), 5000);
  } catch (err) {
    ctx.setPolarSyncMsg({ ok: false, text: err.message });
    setTimeout(() => ctx.setPolarSyncMsg(null), 6000);
  }
  setSyncing(false);
}

export function usePolarSync(ctx) {
  const [syncing, setSyncing] = useState(false);
  return {
    polarSyncing: syncing,
    syncPolar: () => !syncing && syncPolar(ctx, setSyncing),
  };
}
