// api/polar-disconnect.js
// Clears the local Polar connection so the user goes through fresh OAuth.
// Does NOT deregister from Polar Accesslink — that caused re-registration failures.
// The new OAuth flow will issue a new token with updated scopes (including training_data).
// The callback handles the existing-user case (409) gracefully.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const db = getAdminDb();
    // Just mark as disconnected locally — keep polar_user_id so re-registration
    // can handle the 409 "already registered" case in the callback
    const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
    if (connDoc.exists) {
      await db.doc(`users/${userId}/polar/connection`).update({
        connected: false,
        disconnected_at: new Date().toISOString(),
        access_token: null,
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("polar-disconnect error:", err);
    return res.status(500).json({ error: err.message });
  }
}
