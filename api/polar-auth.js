// api/polar-auth.js — POST (signed in, Fix 120): the address of Polar's OAuth login page for the
// person in the Firebase ID token. The reply is { url }; the page then goes there. The user id
// travels in a signed, ten-minute `state` (api/_polar/state.js), so the callback can trust it:
// nobody can start a Polar connection for another user, or finish one with a made-up state.
// Body { v: "4" } is a sign-in to Polar's newer API (heart-rate history).
import { callerOf } from "./_admin/caller.js";
import { verifyIdToken } from "./_admin/verify.js";
import { signState } from "./_polar/state.js";
import { v4AuthUrl } from "./_polar/v4.js";

const POLAR_AUTHORIZE = "https://flow.polar.com/oauth2/authorization";

/** The token check; a test replaces it. */
export const deps = { verify: verifyIdToken, now: () => Date.now() };

/** Polar's login address; `state` is what Polar hands back to the callback. */
export function polarAuthUrl({ clientId, redirectUri, state, v }) {
  if (v === "4") return v4AuthUrl({ clientId, redirectUri, state });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "accesslink.read_all",
    state,
  });
  return `${POLAR_AUTHORIZE}?${params}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const caller = await callerOf(req, deps.verify);
  if (caller.error) return res.status(caller.error.status).json(caller.error.body);
  const {
    POLAR_CLIENT_ID: clientId,
    POLAR_REDIRECT_URI: redirectUri,
    POLAR_CLIENT_SECRET: secret,
  } = process.env;
  if (!clientId || !redirectUri || !secret) {
    return res.status(500).json({ error: "Polar environment variables not configured" });
  }
  const v = req.body?.v === "4" ? "4" : undefined;
  const state = signState({ uid: caller.uid, v: v && 4 }, secret, deps.now());
  return res.status(200).json({ url: polarAuthUrl({ clientId, redirectUri, state, v }) });
}
