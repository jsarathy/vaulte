// api/polar-callback.js
// Polar redirects here after the user approves access.
// Flow:
//   1. Exchange auth code → access_token + polar_user_id
//   2. Register user with Polar AccessLink (POST /v3/users)
//   3. Save connection details to Firestore
//   4. Redirect back to the app

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
  const { code, state, error } = req.query;
  const appUrl = process.env.VAULTE_APP_URL || "https://vaulte-roan.vercel.app";

  // User denied access
  if (error) {
    return res.redirect(302, `${appUrl}/?polar=denied`);
  }

  if (!code || !state) {
    return res.redirect(302, `${appUrl}/?polar=error&reason=missing_params`);
  }

  // Decode the Firebase userId from state
  let firebaseUid;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    firebaseUid = decoded.uid;
  } catch {
    return res.redirect(302, `${appUrl}/?polar=error&reason=bad_state`);
  }

  const clientId     = process.env.POLAR_CLIENT_ID;
  const clientSecret = process.env.POLAR_CLIENT_SECRET;
  const redirectUri  = process.env.POLAR_REDIRECT_URI;

  try {
    // ── Step 1: Exchange auth code for tokens ──────────────────────────────────
    const tokenRes = await fetch("https://polarremote.com/v2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Accept":        "application/json",
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return res.redirect(302, `${appUrl}/?polar=error&reason=token_exchange`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, x_user_id: polarUserId } = tokenData;

    // ── Step 2: Register user with AccessLink ──────────────────────────────────
    // This will 409 if already registered — that's fine, just continue
    const regRes = await fetch("https://www.polaraccesslink.com/v3/users", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${access_token}`,
        "Accept":        "application/json",
      },
      body: JSON.stringify({ "member-id": firebaseUid }),
    });

    // 200 = new registration, 409 = already registered, both are fine
    if (!regRes.ok && regRes.status !== 409) {
      console.error("Polar user registration failed:", regRes.status, await regRes.text());
      // Continue anyway — some Polar plans auto-register
    }

    // ── Step 3: Save to Firestore ──────────────────────────────────────────────
    const db = getAdminDb();
    await db.doc(`users/${firebaseUid}/polar/connection`).set({
      connected:        true,
      access_token,
      polar_user_id:    String(polarUserId),
      connected_at:     new Date().toISOString(),
      last_sync_at:     null,
    });

    return res.redirect(302, `${appUrl}/?polar=connected`);

  } catch (err) {
    console.error("Polar callback error:", err);
    return res.redirect(302, `${appUrl}/?polar=error&reason=server_error`);
  }
}
