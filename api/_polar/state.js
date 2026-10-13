// api/_polar/state.js — the OAuth `state` that carries a person through Polar's sign-in (Fix 120).
// It names the user (and, for Polar's newer API, `v: 4`), is valid for ten minutes and is signed
// with the server's Polar client secret, so the callback knows the server made it for that user:
// nobody can name another user's id in a hand-made link. Node's crypto only; no I/O.
import crypto from "node:crypto";

const TTL_MS = 10 * 60 * 1000;
const b64 = (data) => Buffer.from(data).toString("base64url");

/** The signature of `payload`; a key derived from the secret for this use only. */
const sign = (payload, secret) =>
  crypto.createHmac("sha256", `vaulte-polar-state:${secret}`).update(payload).digest();

const need = (secret) => {
  if (!secret) throw new Error("No secret to sign the Polar state with");
  return secret;
};

/** A signed state for { uid, v } (v optional), valid until `now` plus ten minutes. */
export function signState({ uid, v }, secret, now) {
  const exp = now + TTL_MS;
  const payload = b64(JSON.stringify(v ? { uid, v, exp } : { uid, exp }));
  return `${payload}.${b64(sign(payload, need(secret)))}`;
}

const payloadOf = (text) => {
  try {
    return JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const genuine = (payload, signature, secret) => {
  const want = sign(payload, secret);
  const got = Buffer.from(signature, "base64url");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
};

/** The claims of a state this server signed (whether or not it has expired); null otherwise. */
function signedClaims(state, secret) {
  const [payload, signature, ...extra] = String(state || "").split(".");
  if (!secret || !payload || !signature || extra.length) return null;
  return genuine(payload, signature, secret) ? payloadOf(payload) : null;
}

const named = (claims) => typeof claims?.uid === "string" && claims.uid !== "";
const live = (claims, now) => typeof claims.exp === "number" && claims.exp >= now;

/** { uid, v } for a state this server signed and that has not expired; otherwise
 *  { error: "bad_state" } (unreadable, unsigned or altered) or { error: "state_expired" }. */
export function readState(state, secret, now) {
  const claims = signedClaims(state, secret);
  if (!named(claims)) return { error: "bad_state" };
  if (!live(claims, now)) return { error: "state_expired" };
  return { uid: claims.uid, v: claims.v };
}
