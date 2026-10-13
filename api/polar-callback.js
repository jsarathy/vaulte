// api/polar-callback.js
// Polar redirects here after the user approves access.
// Flow:
//   1. Exchange auth code → access_token + polar_user_id
//   2. Register user with Polar AccessLink (POST /v3/users)
//   3. Save connection details to Firestore
//   4. Redirect back to the app

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { exchangeV4Code, V4_SCOPE } from "./_polar/v4.js";
import { saveV4 } from "./_polar/store.js";
import { readState } from "./_polar/state.js";

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

// A sign-in to Polar's newer API (state `v: 4`): the tokens go to users/{uid}/polar/connection_v4.
async function connectV4(code, uid) {
  const deps = { env: process.env, fetcher: fetch, now: Date.now() };
  const out = await exchangeV4Code(code, process.env.POLAR_REDIRECT_URI, deps);
  if (!out.ok) {
    console.error("Polar v4 token exchange failed:", out.status, out.detail);
    return "v4token";
  }
  const connected_at = new Date().toISOString();
  await saveV4(getAdminDb(), uid, { ...out.tokens, scope: V4_SCOPE, connected_at });
  return "v4connected";
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const back = (outcome) => res.redirect(302, `${appUrl()}/?polar=${outcome}`);
  if (error) return back("denied");
  if (!code || !state) return back("error&reason=missing_params");
  // the state is the server's own, signed for one user (Fix 120): bad_state or state_expired if not
  const decoded = readState(state, process.env.POLAR_CLIENT_SECRET, Date.now());
  if (decoded.error) return back(`error&reason=${decoded.error}`);
  try {
    return back(await (decoded.v === 4 ? connectV4 : connect)(code, decoded.uid));
  } catch (err) {
    console.error("Polar callback error:", err);
    return back("error&reason=server_error");
  }
}
