// src/lib/confirmGate.js — who must confirm an email address before entering the app (Fix 130): a
// person with a password account whose address is not yet confirmed. Google and sign-in-link
// accounts are confirmed by the way they sign in.

/** True for a signed-in password account whose email address is not confirmed. */
export const needsConfirmation = (user) =>
  !!user &&
  user.emailVerified !== true &&
  (user.providerData ?? []).some((p) => p.providerId === "password");
