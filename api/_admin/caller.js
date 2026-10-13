// api/_admin/caller.js — who is calling a server function: the Firebase ID token in the request's
// Authorization header (Bearer), checked with verifyIdToken. A function that acts for a person takes
// the user id from here, never from the request body.
import { verifyIdToken } from "./verify.js";

const rejected = (error) => ({ error: { status: 401, body: { error } } });

/** { uid, claims } for a valid ID token, else { error: { status: 401, body } } to send back.
 *  `verify` is the token check (a function's `deps.verify`, so tests can stand in for Google's keys). */
export async function callerOf(req, verify = verifyIdToken) {
  const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return rejected("Not signed in");
  try {
    const claims = await verify(token);
    return { uid: claims.uid, claims };
  } catch {
    return rejected("Invalid or expired sign-in");
  }
}
