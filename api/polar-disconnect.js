// api/polar-disconnect.js
// Deregisters from Polar Accesslink then immediately re-registers with the same member-id.
// This forces a new OAuth consent (new token with training_data scope) without breaking
// the registration state that the callback depends on.

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
    if (!connDoc.exists || !connDoc.data().connected) {
      // Not connected — just clear and let auth flow handle it
      await db.doc(`users/${userId}/polar/connection`).set({ connected: false });
      return res.json({ ok: true, action: "cleared" });
    }

    const { access_token, polar_user_id } = connDoc.data();
    const AUTH_HDR = { "Authorization": `Bearer ${access_token}`, "Accept": "application/json" };

    // Step 1: Delete from Accesslink (revokes the OAuth grant on Polar's side)
    const delRes = await fetch(
      `https://www.polaraccesslink.com/v3/users/${polar_user_id}`,
      { method: "DELETE", headers: AUTH_HDR }
    );
    console.log("Polar DELETE /v3/users status:", delRes.status);
    // 204 = deleted, 404 = already gone — both are acceptable

    // Step 2: Immediately re-register the same member-id with the same token.
    // This re-creates the Accesslink account in a clean state so the callback
    // won't fail with anything other than 200/409 on the next auth.
    // We use a small delay to let Polar process the deletion.
    await new Promise(r => setTimeout(r, 500));

    const regRes = await fetch("https://www.polaraccesslink.com/v3/users", {
      method: "POST",
      headers: { ...AUTH_HDR, "Content-Type": "application/json" },
      body: JSON.stringify({ "member-id": userId }),
    });
    console.log("Polar re-register status:", regRes.status);
    // 200 = re-registered, 409 = Polar not fully cleared yet — both fine for our purposes

    // Step 3: Mark as disconnected locally — new token will be saved in callback
    await db.doc(`users/${userId}/polar/connection`).update({
      connected: false,
      access_token: null,
      disconnected_at: new Date().toISOString(),
    });

    return res.json({ ok: true, action: "deregistered_and_reregistered" });

  } catch (err) {
    console.error("polar-disconnect error:", err);
    // Still mark as disconnected even if Polar API calls failed
    try {
      const db = getAdminDb();
      await db.doc(`users/${userId}/polar/connection`).update({
        connected: false, access_token: null,
      });
    } catch {}
    return res.status(500).json({ error: err.message });
  }
}
