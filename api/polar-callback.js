// api/polar-callback.js
// Polar redirects here after the user approves access.
// Flow:
//   1. Exchange auth code → access_token + polar_user_id
//   2. Register user with Polar AccessLink (POST /v3/users)
//   3. Save connection details to Firestore
//   4. Redirect back to the app

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const POLAR_USERS = "https://www.polaraccesslink.com/v3/users";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

const appUrl = () => process.env.VAULTE_APP_URL || "https://vaulte-roan.vercel.app";

// The Firebase userId from the OAuth state (see polar-auth.js); null if the state is unreadable.
function decodeState(state) {
  try {
    return { uid: JSON.parse(Buffer.from(state, "base64url").toString("utf8")).uid };
  } catch {
    return null;
  }
}

function tokenRequest(code) {
  const { POLAR_CLIENT_ID: id, POLAR_CLIENT_SECRET: secret, POLAR_REDIRECT_URI } = process.env;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: POLAR_REDIRECT_URI,
    }).toString(),
  };
}

// Step 1: auth code → { accessToken, polarUserId }, or null if Polar refuses.
async function exchangeCode(code) {
  const tokenRes = await fetch(TOKEN_URL, tokenRequest(code));
  if (!tokenRes.ok) {
    console.error("Token exchange failed:", await tokenRes.text());
    return null;
  }
  const { access_token, x_user_id } = await tokenRes.json();
  return { accessToken: access_token, polarUserId: x_user_id };
}

// Step 2: 200 = new registration, 409 = already registered. Anything else is logged but not
// fatal — the new access token is valid either way.
async function registerWithAccessLink(accessToken, uid) {
  const regRes = await fetch(POLAR_USERS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    body: JSON.stringify({ "member-id": uid }),
  });
  console.log("Polar registration status:", regRes.status);
  if (!regRes.ok && regRes.status !== 409) {
    console.warn("Polar registration non-fatal error:", regRes.status, await regRes.text());
  }
}

// Step 3
const saveConnection = (uid, { accessToken, polarUserId }) =>
  getAdminDb()
    .doc(`users/${uid}/polar/connection`)
    .set({
      connected: true,
      access_token: accessToken,
      polar_user_id: String(polarUserId),
      connected_at: new Date().toISOString(),
      last_sync_at: null,
    });

// Steps 1–3; returns the outcome for the redirect.
async function connect(code, uid) {
  const token = await exchangeCode(code);
  if (!token) return "error&reason=token_exchange";
  await registerWithAccessLink(token.accessToken, uid);
  await saveConnection(uid, token);
  return "connected";
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const back = (outcome) => res.redirect(302, `${appUrl()}/?polar=${outcome}`);
  if (error) return back("denied");
  if (!code || !state) return back("error&reason=missing_params");
  const decoded = decodeState(state);
  if (!decoded) return back("error&reason=bad_state");
  try {
    return back(await connect(code, decoded.uid));
  } catch (err) {
    console.error("Polar callback error:", err);
    return back("error&reason=server_error");
  }
}
