// api/_admin/verify.js — checks a Firebase ID token without the Firebase Admin Auth module (Fix 105).
// firebase-admin/auth pulls in jwks-rsa, which require()s the ES-only jose and crashes on Vercel's
// Node ("ERR_REQUIRE_ESM"). A Firebase ID token is a signed JWT, so jose checks it directly against
// Google's public signing keys: the signature, that it was issued for this project, and that it has
// not expired.
import { createRemoteJWKSet, jwtVerify } from "jose";

const KEYS = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
);
const REMOTE_KEYS = createRemoteJWKSet(KEYS);

/** The project this server belongs to: from the service account, else Vaulte's own. */
export function projectId(env = process.env) {
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "{}").project_id || "vaulte-1ea20";
  } catch {
    return "vaulte-1ea20";
  }
}

/** The token's claims when it is a valid, unexpired ID token for this project; throws otherwise. */
export async function verifyIdToken(token, { keys = REMOTE_KEYS, project = projectId() } = {}) {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${project}`,
    audience: project,
  });
  if (!payload.sub) throw new Error("No subject");
  return { ...payload, uid: payload.sub };
}
