// src/api/claudeFetch.js — one call to the /api/claude proxy (Fix 126): the sign-in proof, and what
// to do when the proxy says the person's email address is not confirmed yet. The link in the
// confirmation email may have been opened since the sign-in was issued, so the sign-in is refreshed
// and the call tried once more; if it is still refused the email is sent again (once) and the
// person is told what to do.
import { authHeader, refreshAuth, resendConfirmationOnce } from "./authToken.js";

export const UNCONFIRMED_MESSAGE =
  "Confirm your email address to use Claude. Open the link we emailed you, then try again.";

export const NOT_APPROVED_MESSAGE =
  "Claude is waiting for approval. The owner has been told and will let you in.";

const send = async (body) =>
  fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });

const unconfirmed = (res) =>
  res.status === 403 && res.headers?.get?.("x-vaulte-reason") === "email_not_confirmed";

const notApproved = (res) =>
  res.status === 403 && res.headers?.get?.("x-vaulte-reason") === "not_approved";

/** The proxy's reply to `body`; throws UNCONFIRMED_MESSAGE when the email is not confirmed and
 *  NOT_APPROVED_MESSAGE when the owner has not yet let the person in (Fix 134). */
export async function claudeFetch(body) {
  const first = await send(body);
  if (notApproved(first)) throw new Error(NOT_APPROVED_MESSAGE);
  if (!unconfirmed(first)) return first;
  await refreshAuth();
  const second = await send(body);
  if (notApproved(second)) throw new Error(NOT_APPROVED_MESSAGE);
  if (!unconfirmed(second)) return second;
  await resendConfirmationOnce();
  throw new Error(UNCONFIRMED_MESSAGE);
}
