// src/api/adminUsers.js — the Dashboard's Users card talks to /api/admin-users (Fix 104). Every call
// carries the signed-in user's Firebase ID token; the server decides who is an admin.
import { auth } from "../firebase";

async function call(action) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** True when the signed-in user is an admin (the Users card is shown only then). */
export const checkAdmin = async () => (await call("check")).admin === true;

/** Every user: { uid, member_id, name, email, phone, address, created, last_sign_in, providers, disabled }. */
export const loadUsers = async () => (await call("list")).users || [];
