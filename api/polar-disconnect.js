// api/polar-disconnect.js
// Deregisters the user from Polar Accesslink and clears stored credentials.
// After this, clicking Connect again forces a fresh OAuth consent with all scopes.

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

    const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
    if (!connDoc.exists) {
      return res.json({ ok: true, message: "Not connected" });
    }

    const { access_token, polar_user_id } = connDoc.data();

    // Deregister from Polar Accesslink — this clears their grant so next auth shows full consent
    if (polar_user_id && access_token) {
      try {
        const delRes = await fetch(
          `https://www.polaraccesslink.com/v3/users/${polar_user_id}`,
          {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${access_token}` },
          }
        );
        console.log("Polar deregister response:", delRes.status);
        // 204 = success, 404 = already gone — both are fine
      } catch (e) {
        console.warn("Polar deregister failed (continuing anyway):", e.message);
      }
    }

    // Clear from Firestore
    await db.doc(`users/${userId}/polar/connection`).set({
      connected: false,
      disconnected_at: new Date().toISOString(),
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("polar-disconnect error:", err);
    return res.status(500).json({ error: err.message });
  }
}
