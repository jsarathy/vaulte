// src/api/adminUsers.js — the Dashboard's Users card talks to /api/admin-users (Fix 104). Every call
// carries the signed-in user's Firebase ID token; the server decides who is an admin.
import { auth } from "../firebase";

async function call(action, extra = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** { admin, approved }: whether the signed-in user is an admin (the Users card is shown only then) and
 *  whether Claude is open to them (Fix 134; false means waiting for the owner, undefined unknown). */
export async function checkAccess() {
  const data = await call("check");
  return { admin: data.admin === true, approved: data.approved };
}

/** True when the signed-in user is an admin. */
export const checkAdmin = async () => (await checkAccess()).admin;

/** Every user: { uid, member_id, name, email, phone, address, created, last_sign_in, providers, disabled }. */
export const loadUsers = async () => (await call("list")).users || [];

/** Deletes a user (admins only): their login, photo and everything they saved. Never your own or an admin's. */
export const deleteUser = async (uid) => (await call("delete", { uid })).ok === true;

/** Lets a waiting person use Claude (admins only). */
export const approveUser = async (uid) => (await call("approve", { uid })).ok === true;

/** The signed-in person's own user id (the table does not offer to delete it). */
export const myUid = () => auth.currentUser?.uid;
