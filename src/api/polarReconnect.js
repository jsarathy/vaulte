// src/api/polarReconnect.js — Polar "Reconnect": re-authorise with the permissions HR data needs.

const CONFIRM =
  "This will re-authorise your Polar account with updated permissions (needed for HR data). Continue?";

// Best effort: the re-authorisation goes ahead even if this fails
async function disconnect(userId) {
  try {
    const r = await fetch("/api/polar-disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  window.location.href = `/api/polar-auth?userId=${userId}`;
}
