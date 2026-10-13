// src/api/polarSignIn.js — starting Polar's sign-in (Fix 120). A signed-in call asks the server for
// the address to go to (the server signs the state for this user, from the ID token), then the
// browser goes there; Polar redirects back to the server's callback. `v: "4"` is Polar's newer API.
import { authHeader } from "./authToken.js";

/** Asks the server for Polar's sign-in address and goes there; an alert says why if it cannot. */
export async function signInToPolar(v) {
  try {
    const res = await fetch("/api/polar-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(v ? { v } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || `Request failed (${res.status})`);
    window.location.href = data.url;
  } catch (err) {
    alert(`Could not start the Polar sign-in: ${err.message}`);
  }
}
