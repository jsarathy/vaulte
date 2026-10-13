// src/api/authToken.js — the sign-in proof a call to a server function carries (Fix 118). The app
// says once where the current user's Firebase ID token comes from (src/firebase.js); every call
// that acts for the person then adds it as `Authorization: Bearer …`, and the server checks it.

let source = null;

/** Where the ID token comes from: a function that gives it (or null when nobody is signed in). */
export const setTokenSource = (fn) => {
  source = fn || null;
};

/** `{ Authorization: "Bearer <token>" }`, or `{}` when nobody is signed in (the server then says 401). */
export async function authHeader() {
  const token = source ? await source() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Email confirmation (Fix 126): the Claude proxy answers only a person whose email address is
// confirmed. The app says once how to refresh the sign-in (a link may have been opened since the
// ID token was issued) and how to send the confirmation email again (src/firebase.js).
let tools = { refresh: null, resend: null };
let resent = false;

/** { refresh, resend }: functions that refresh the sign-in and send the confirmation email. */
export const setAuthTools = (t) => {
  tools = { refresh: t?.refresh || null, resend: t?.resend || null };
  resent = false;
};

/** Asks Firebase for the person's latest details and a fresh ID token; a failure changes nothing. */
export async function refreshAuth() {
  try {
    await tools.refresh?.();
  } catch (err) {
    console.warn("sign-in not refreshed:", err.message);
  }
}

/** Sends the confirmation email, but only once per page load (so a retry does not send another). */
export async function resendConfirmationOnce() {
  if (resent) return false;
  resent = true;
  try {
    await tools.resend?.();
    return true;
  } catch (err) {
    console.warn("confirmation email not sent:", err.message);
    return false;
  }
}
