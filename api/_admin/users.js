// api/_admin/users.js — the admin Users list behind the Dashboard's Users card (Fix 104), without
// any Firebase call (so the unit tests can load it): who counts as an admin, and one row per user
// joining Firebase Authentication (email, sign-in method, dates) with the profile in Firestore
// (name, phone, address, member id). The reading is in store.js.
/** The addresses in ADMIN_EMAILS (comma separated, any case) as a lower-case set. */
export const adminEmails = (env = process.env) =>
  new Set(
    String(env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

/** True when an address (any case) is in ADMIN_EMAILS, whoever holds it. */
export const isAdminEmail = (email, env = process.env) =>
  adminEmails(env).has(String(email || "").toLowerCase());

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

const msIso = (ms) => {
  const d = new Date(Number(ms));
  return ms && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
};

/** A user from the Identity Toolkit REST list (accounts:batchGet) as the shape userRow reads. */
export const restUserToAuth = (u) => ({
  uid: u.localId,
  email: u.email,
  displayName: u.displayName,
  disabled: u.disabled === true,
  metadata: { creationTime: msIso(u.createdAt), lastSignInTime: msIso(u.lastLoginAt) },
  providerData: (u.providerUserInfo || []).map((p) => ({ providerId: p.providerId })),
});

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
