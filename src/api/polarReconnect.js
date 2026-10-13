// src/api/polarReconnect.js — Polar "Reconnect": re-authorise with the permissions HR data needs.
import { authHeader } from "./authToken.js";
import { signInToPolar } from "./polarSignIn.js";

const CONFIRM =
  "This will re-authorise your Polar account with updated permissions (needed for HR data). Continue?";

// Best effort: the re-authorisation goes ahead even if this fails
async function disconnect(userId) {
  try {
    const r = await fetch("/api/polar-disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ userId }),
    });
    console.log("Disconnect result:", await r.json());
  } catch (e) {
    console.warn("Disconnect failed, continuing:", e);
  }
}

/** Asks first; the button shows "Working…" until the browser moves to Polar's sign-in. */
export async function reconnectPolar(userId, button) {
  console.log("Reconnect clicked, userId:", userId);
  if (!userId) return alert("Not logged in — please refresh and try again.");
  if (!confirm(CONFIRM)) return;
  button.textContent = "Working…";
  await disconnect(userId);
  await signInToPolar();
}

const V4_CONFIRM =
  "This signs in to Polar's newer data service, which can read past heart-rate data. You will go to Polar and come back. Continue?";

/** Sign in to Polar's newer API (v4) alongside the existing connection; asks first. */
export function connectPolarV4(userId) {
  if (!userId) return alert("Not logged in — please refresh and try again.");
  if (!confirm(V4_CONFIRM)) return;
  return signInToPolar("4");
}
