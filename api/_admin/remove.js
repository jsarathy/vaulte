// api/_admin/remove.js — removes one person completely (Fix 127), for an admin deleting a user from
// the Users card: their login (Identity Toolkit REST), their profile photo (Cloud Storage JSON API)
// and everything under users/{uid} in Firestore. No firebase-admin/auth: see verify.js.
import { getFirestore } from "firebase-admin/firestore";
import { accessToken, adminApp } from "./store.js";
import { projectId } from "./verify.js";

const UID_OK = /^[A-Za-z0-9_-]{1,128}$/;

/** True for something that can be a Firebase user id. */
export const validUid = (uid) => typeof uid === "string" && UID_OK.test(uid);

const bucket = () => `${projectId()}.firebasestorage.app`;
const photoObject = (uid) => encodeURIComponent(`profile-photos/${uid}.jpg`);

const context = ({ token, fetchJson = (u, o) => fetch(u, o) } = {}) => ({
  fetchJson,
  headers: async () => ({ Authorization: `Bearer ${token || (await accessToken())}` }),
});

/** The login. A user that is already gone is fine. */
async function deleteLogin(uid, ctx) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}/accounts:delete`;
  const res = await ctx.fetchJson(url, {
    method: "POST",
    headers: { ...(await ctx.headers()), "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  });
  if (res.ok) return;
  const detail = String((await res.json().catch(() => ({})))?.error?.message || "");
  if (!detail.includes("USER_NOT_FOUND")) throw new Error(`Login not deleted (${res.status})`);
}

/** The profile photo. No photo is fine. */
async function deletePhoto(uid, ctx) {
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket()}/o/${photoObject(uid)}`;
  const res = await ctx.fetchJson(url, { method: "DELETE", headers: await ctx.headers() });
  if (!res.ok && res.status !== 404) throw new Error(`Photo not deleted (${res.status})`);
}

/** The profile document and every collection under it. */
async function deleteData(uid) {
  adminApp();
  const db = getFirestore();
  await db.recursiveDelete(db.doc(`users/${uid}`));
}

/** The three steps; `token` and `fetchJson` are replaceable for tests. */
export function removalSteps(options) {
  const ctx = context(options);
  return {
    deleteLogin: (uid) => deleteLogin(uid, ctx),
    deletePhoto: (uid) => deletePhoto(uid, ctx),
    deleteData,
  };
}

/** Removes the person: the login first (so they cannot sign in again), then the photo and the data. */
export async function removeUser(uid, steps = removalSteps()) {
  await steps.deleteLogin(uid);
  await steps.deletePhoto(uid);
  await steps.deleteData(uid);
}
