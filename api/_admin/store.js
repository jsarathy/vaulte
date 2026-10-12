// api/_admin/store.js — reads the users for the Dashboard's Users card (Fix 104): every Authentication
// user and every profile document (Firebase Admin), joined by users.js.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { mergeUsers } from "./users.js";

export function adminApp() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
}

async function allAuthUsers(auth) {
  const out = [];
  let token;
  do {
    const page = await auth.listUsers(1000, token);
    out.push(...page.users);
    token = page.pageToken;
  } while (token);
  return out;
}

export async function listUsers() {
  adminApp();
  const [authUsers, snap] = await Promise.all([
    allAuthUsers(getAuth()),
    getFirestore().collection("users").get(),
  ]);
  const profiles = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  return mergeUsers(authUsers, profiles);
}
