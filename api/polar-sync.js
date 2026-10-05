// api/polar-sync.js — pulls the exercises recorded since the last sync from Polar AccessLink
// into users/{uid}/polar_sessions. The client, HR samples, session shape and Firestore access
// live in api/_polar/ (not deployed as functions).
import { polarClient } from "./_polar/client.js";
import { fetchSessions } from "./_polar/sessions.js";
import { getAdminDb, loadConnection, saveSessions, stampSync } from "./_polar/store.js";

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
  const sessions = await fetchSessions(urls, polar); // before the commit: Polar forgets them after
  await polar.commitTransaction(tx.id);
  await saveSessions(db, userId, sessions);
  return reply(200, { newSessions: sessions.length, sessions });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    const { status, body } = await syncUser(userId);
    return res.status(status).json(body);
  } catch (err) {
    console.error("Polar sync error:", err);
    return res.status(500).json({ error: err.message });
  }
}
