// api/polar-auth.js
// Redirects the user to Polar's OAuth login page.
// Called from the frontend as: window.location.href = '/api/polar-auth?userId=FIREBASE_UID'

import { v4AuthUrl } from "./_polar/v4.js";

const POLAR_AUTHORIZE = "https://flow.polar.com/oauth2/authorization";

// The Firebase userId travels in the OAuth state param so the callback can recover it; `v: 4`
// marks a sign-in to Polar's newer API (heart-rate history).
const encodeState = (userId, v) =>
  Buffer.from(JSON.stringify(v ? { uid: userId, v } : { uid: userId })).toString("base64url");

export function polarAuthUrl({ clientId, redirectUri, userId, v }) {
  if (v === "4") return v4AuthUrl({ clientId, redirectUri, state: encodeState(userId, 4) });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "accesslink.read_all",
    state: encodeState(userId),
  });
  return `${POLAR_AUTHORIZE}?${params}`;
}

export default function handler(req, res) {
  const { userId, v } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId parameter" });
  const clientId = process.env.POLAR_CLIENT_ID;
  const redirectUri = process.env.POLAR_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Polar environment variables not configured" });
  }
  return res.redirect(302, polarAuthUrl({ clientId, redirectUri, userId, v }));
}
