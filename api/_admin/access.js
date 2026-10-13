// api/_admin/access.js — who may use Claude (Fix 134). An admin always may. Anyone else needs a record
// in the server-only collection approvals/{uid} (the Firestore rules close it to the app) saying
// "approved". A person who has confirmed their email and has no record yet is either an account from
// before this rule (made before GRANDFATHER_BEFORE: approved at once, as "existing") or new: a
// "pending" record is made and the admins are emailed once. An admin approves from the Users table.
import { getFirestore } from "firebase-admin/firestore";
import { accessToken, adminApp } from "./store.js";
import { notifyAdmins } from "./notify.js";
import { isAdmin } from "./users.js";
import { projectId } from "./verify.js";

/** Accounts created before this moment keep their use of Claude without being approved. */
export const GRANDFATHER_BEFORE = Date.parse("2026-10-13T00:00:00Z");

const approvals = () => {
  adminApp();
  return getFirestore().collection("approvals");
};

/** When the login was created (ms since 1970), from Identity Toolkit; null if it cannot be told. */
export async function createdAtOf(uid, { token, fetchJson = (u, o) => fetch(u, o) } = {}) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}/accounts:lookup`;
  const res = await fetchJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token || (await accessToken())}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ localId: [uid] }),
  });
  if (!res.ok) throw new Error(`Login lookup failed (${res.status})`);
  const ms = Number((await res.json())?.users?.[0]?.createdAt);
  return Number.isFinite(ms) ? ms : null;
}

/** The real stores; tests pass their own. */
export const realStore = {
  get: async (uid) => {
    const snap = await approvals().doc(uid).get();
    return snap.exists ? snap.data() : null;
  },
  /** Makes the record only if there is none: true when this call made it. */
  create: async (uid, data) => {
    try {
      await approvals().doc(uid).create(data);
      return true;
    } catch (err) {
      if (err.code === 6) return false; // ALREADY_EXISTS: another request got there first
      throw err;
    }
  },
  set: (uid, data) => approvals().doc(uid).set(data, { merge: true }),
  all: async () => Object.fromEntries((await approvals().get()).docs.map((d) => [d.id, d.data()])),
  createdAt: (uid) => createdAtOf(uid),
};

const now = () => new Date().toISOString();

/** { approved } for the person in this ID token (and, for a new one, the record and the email). */
export async function accessOf(decoded, { store = realStore, notify = notifyAdmins } = {}) {
  if (isAdmin(decoded)) return { approved: true };
  if (decoded.email_verified !== true) return { approved: false }; // nothing is recorded until confirmed
  const existing = await store.get(decoded.uid);
  if (existing) return { approved: existing.status === "approved" };
  const created = await store.createdAt(decoded.uid);
  if (created !== null && created < GRANDFATHER_BEFORE) {
    await store.create(decoded.uid, { status: "approved", source: "existing", at: now() });
    return { approved: true };
  }
  const record = { status: "pending", email: decoded.email || "", requestedAt: now() };
  if (await store.create(decoded.uid, record)) await notify({ email: record.email });
  return { approved: (await store.get(decoded.uid))?.status === "approved" };
}

/** An admin lets a person in. */
export const approve = (uid, by, store = realStore) =>
  store.set(uid, { status: "approved", source: "admin", approvedBy: by, at: now() });

/** { [uid]: record } for the Users table. */
export const allApprovals = (store = realStore) => store.all();
