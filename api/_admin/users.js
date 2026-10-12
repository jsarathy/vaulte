// api/_admin/users.js — the admin Users list behind the Dashboard's Users card (Fix 104): who counts
// as an admin, and one row per user joining Firebase Authentication (email, sign-in method, dates)
// with the profile in Firestore (name, phone, address, member id). Firebase Admin; never called
// from the browser directly.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function adminApp() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
}

/** The addresses in ADMIN_EMAILS (comma separated, any case) as a lower-case set. */
export const adminEmails = (env = process.env) =>
  new Set(
    String(env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

/** True for a verified-email sign-in whose address is in ADMIN_EMAILS. */
export const isAdmin = (decoded, env = process.env) =>
  decoded?.email_verified === true &&
  typeof decoded.email === "string" &&
  adminEmails(env).has(decoded.email.toLowerCase());

const iso = (t) => {
  const d = new Date(t);
  return t && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};
const fullName = (p, a) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(" ") || a?.displayName || "";

const contact = (p) => ({
  phone: p?.phone || "",
  address: [p?.address, p?.city, p?.postcode].filter(Boolean).join(", "),
});

/** One user: what Authentication knows (auth) and what the profile document says (profile). */
export function userRow(uid, auth, profile) {
  return {
    uid,
    member_id: profile?.uid || "",
    name: fullName(profile, auth),
    email: auth?.email || profile?.email || "",
    ...contact(profile),
    created: iso(auth?.metadata?.creationTime),
    last_sign_in: iso(auth?.metadata?.lastSignInTime),
    providers: (auth?.providerData || []).map((p) => p.providerId),
    disabled: auth?.disabled === true,
  };
}

/** Every user from either source, oldest account first (then by email). */
export function mergeUsers(authUsers, profiles) {
  const byUid = new Map(authUsers.map((a) => [a.uid, a]));
  const uids = new Set([...byUid.keys(), ...Object.keys(profiles)]);
  return [...uids]
    .map((uid) => userRow(uid, byUid.get(uid), profiles[uid]))
    .sort(
      (a, b) =>
        (a.created || "9999").localeCompare(b.created || "9999") || a.email.localeCompare(b.email),
    );
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
