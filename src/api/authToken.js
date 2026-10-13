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
