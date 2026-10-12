// api/admin-users.js — the Dashboard's Users card (Fix 104, 105). POST with the signed-in user's
// Firebase ID token as `Authorization: Bearer <token>` and { action }:
//   "check" → { admin: true | false } (any signed-in user may ask; the card is hidden unless true)
//   "list"  → { users: [...] } (admins only; 403 otherwise)
// An admin is a verified-email user whose address is in the ADMIN_EMAILS environment variable
// (comma separated). With the variable unset nobody is an admin.
import { listUsers } from "./_admin/store.js";
import { isAdmin } from "./_admin/users.js";
import { verifyIdToken } from "./_admin/verify.js";

/** What the handler calls out to; tests replace these. */
export const deps = { verify: verifyIdToken, list: listUsers };

const bearer = (req) => String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

async function verified(token) {
  try {
    return await deps.verify(token);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "Sign in first" });
  const decoded = await verified(token);
  if (!decoded) return res.status(401).json({ error: "Invalid sign-in" });
  const admin = isAdmin(decoded);
  const action = req.body?.action;
  if (action === "check") return res.status(200).json({ admin });
  if (action !== "list") return res.status(400).json({ error: "Unknown action" });
  if (!admin) return res.status(403).json({ error: "Not an admin" });
  try {
    return res.status(200).json({ users: await deps.list() });
  } catch (err) {
    console.error("admin-users error:", err);
    return res.status(500).json({ error: "Could not list the users" });
  }
}
