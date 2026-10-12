// api/_admin/store.js — reads the users for the Dashboard's Users card (Fix 104, 105): every
// Authentication user (Identity Toolkit REST, with the service account's access token) and every
// profile document (Firestore), joined by users.js. No firebase-admin/auth: see verify.js.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mergeUsers, restUserToAuth } from "./users.js";
import { projectId } from "./verify.js";

function adminApp() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
}

async function accessToken() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  return (await cert(serviceAccount).getAccessToken()).access_token;
}

/** Every Authentication user, page by page. `token` and `fetchJson` are replaceable for tests. */
export async function authUsers({ token, fetchJson = (u, h) => fetch(u, { headers: h }) } = {}) {
  const bearer = token || (await accessToken());
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}/accounts:batchGet?maxResults=1000`;
  const out = [];
  let next;
  do {
    const res = await fetchJson(next ? `${base}&nextPageToken=${next}` : base, {
      Authorization: `Bearer ${bearer}`,
    });
    if (!res.ok) throw new Error(`Authentication list failed (${res.status})`);
    const page = await res.json();
    out.push(...(page.users || []).map(restUserToAuth));
    next = page.nextPageToken;
  } while (next);
  return out;
}

export async function listUsers(options) {
  adminApp();
  const [users, snap] = await Promise.all([
    authUsers(options),
    getFirestore().collection("users").get(),
  ]);
  const profiles = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  return mergeUsers(users, profiles);
}
