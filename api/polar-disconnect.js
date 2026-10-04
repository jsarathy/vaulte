// api/polar-disconnect.js
// Deregisters from Polar Accesslink then immediately re-registers with the same member-id.
// This forces a new OAuth consent (new token with training_data scope) without breaking
// the registration state that the callback depends on.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const POLAR_USERS = "https://www.polaraccesslink.com/v3/users";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

const connectionDoc = (db, userId) => db.doc(`users/${userId}/polar/connection`);
const polarHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: "application/json" });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Delete from Accesslink (revokes the OAuth grant on Polar's side; 204 deleted, 404 already
// gone), then re-register the same member-id with the same token so the account is in a
// clean state for the next auth (200 re-registered, 409 not yet cleared — both fine).
async function resetPolarRegistration({ userId, access_token, polar_user_id }) {
  const headers = polarHeaders(access_token);
  const delRes = await fetch(`${POLAR_USERS}/${polar_user_id}`, { method: "DELETE", headers });
  console.log("Polar DELETE /v3/users status:", delRes.status);
  await pause(500); // let Polar process the deletion
  const regRes = await fetch(POLAR_USERS, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ "member-id": userId }),
  });
  console.log("Polar re-register status:", regRes.status);
}

// Not connected → just clear and let the auth flow handle it. Connected → reset with Polar,
// then mark disconnected locally (the new token is saved by the callback).
async function disconnect(db, userId) {
  const ref = connectionDoc(db, userId);
  const snap = await ref.get();
  if (!snap.exists || !snap.data().connected) {
    await ref.set({ connected: false });
    return { ok: true, action: "cleared" };
  }
  await resetPolarRegistration({ userId, ...snap.data() });
  await ref.update({
    connected: false,
    access_token: null,
    disconnected_at: new Date().toISOString(),
  });
  return { ok: true, action: "deregistered_and_reregistered" };
}

// Still mark as disconnected even if Polar's API calls failed.
async function markDisconnectedAfterError(userId) {
  try {
    await connectionDoc(getAdminDb(), userId).update({ connected: false, access_token: null });
  } catch {
    /* best effort — the original error is returned */
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  try {
    return res.json(await disconnect(getAdminDb(), userId));
  } catch (err) {
    console.error("polar-disconnect error:", err);
    await markDisconnectedAfterError(userId);
    return res.status(500).json({ error: err.message });
  }
}
