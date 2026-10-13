// api/polar-sync.js — pulls the exercises recorded since the last sync from Polar AccessLink
// into users/{uid}/polar_sessions. The client, HR samples, session shape and Firestore access
// live in api/_polar/ (not deployed as functions). Only a signed-in person may call it (their
// Firebase ID token, Fix 119), and it syncs that person's own Polar account: the user id comes from
// the token, not from the request.
import { callerOf } from "./_admin/caller.js";
import { verifyIdToken } from "./_admin/verify.js";
import { polarClient } from "./_polar/client.js";
import { fetchSessions, fillMissingHr } from "./_polar/sessions.js";
import { getAdminDb, loadConnection, saveSessions, stampSync } from "./_polar/store.js";

/** The token check; a test replaces it. */
export const deps = { verify: verifyIdToken };

const reply = (status, body) => ({ status, body });
const NOTHING_NEW = { newSessions: 0, sessions: [] };

/** The sync for one user as { status, body }. */
async function syncUser(userId) {
  const db = getAdminDb();
  const connection = await loadConnection(db, userId);
  if (!connection) return reply(401, { error: "Polar account not connected" });
  const polar = polarClient(connection);
  const tx = await polar.openTransaction();
  if (tx.empty) return stampSync(db, userId).then(() => reply(200, NOTHING_NEW));
  if ("error" in tx)
    return reply(502, { error: "Failed to create Polar transaction", detail: tx.error });
  const urls = await polar.listExercises(tx.id);
  if (!urls) return reply(502, { error: "Failed to list exercises" });
  const fetched = await fetchSessions(urls, polar); // before the commit: Polar forgets them after
  const sessions = await fillMissingHr(fetched, polar.auth, polar.polar_user_id);
  await polar.commitTransaction(tx.id);
  await saveSessions(db, userId, sessions);
  return reply(200, { newSessions: sessions.length, sessions });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const caller = await callerOf(req, deps.verify);
  if (caller.error) return res.status(caller.error.status).json(caller.error.body);
  try {
    const { status, body } = await syncUser(caller.uid);
    return res.status(status).json(body);
  } catch (err) {
    console.error("Polar sync error:", err);
    return res.status(500).json({ error: err.message });
  }
}
