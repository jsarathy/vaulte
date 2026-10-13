// api/admin-users.js — the Dashboard's Users card (Fix 104, 105). POST with the signed-in user's
// Firebase ID token as `Authorization: Bearer <token>` and { action }:
//   "check" → { admin: true | false, approved } (any signed-in user may ask; the card is hidden unless
//             admin; `approved` says whether Claude is open to them, and asking records a new
//             confirmed person as waiting and emails the admins; Fix 134)
//   "list"  → { users: [...] } (admins only; 403 otherwise; each user has `admin`: true for an admin address)
//   "approve" with { uid } → { ok: true }: lets that person use Claude (admins only; Fix 134)
//   "delete" with { uid } → { ok: true }: removes that person's login, photo and data (admins only;
//             never your own account or another admin's; Fix 127)
// An admin is a verified-email user whose address is in the ADMIN_EMAILS environment variable
// (comma separated). With the variable unset nobody is an admin.
import { accessOf, allApprovals, approve } from "./_admin/access.js";
import { listUsers } from "./_admin/store.js";
import { removeUser, validUid } from "./_admin/remove.js";
import { isAdmin, isAdminEmail } from "./_admin/users.js";
import { verifyIdToken } from "./_admin/verify.js";

/** What the handler calls out to; tests replace these. */
export const deps = {
  verify: verifyIdToken,
  list: listUsers,
  remove: removeUser,
  access: accessOf,
  approvals: allApprovals,
  approve,
};

const bearer = (req) => String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

async function verified(token) {
  try {
    return await deps.verify(token);
  } catch {
    return null;
  }
}

/** The users with `admin` marked (the card does not offer to delete an admin) and `approval` ("approved",
 *  "pending", or "" for a person with no record yet), for the card. */
const forCard = (users, records) =>
  users.map((u) => {
    const admin = isAdminEmail(u.email);
    return { ...u, admin, approval: admin ? "approved" : records[u.uid]?.status || "" };
  });

/** The approval records; the list still works without them. */
const recordsOrNone = () => deps.approvals().catch(() => ({}));

/** Whether Claude is open to this person (undefined when that could not be told). */
const approvedFor = (decoded) =>
  deps
    .access(decoded)
    .then((a) => a.approved)
    .catch((err) => console.error("admin-users: access check failed:", err.message));

/** Lets one person use Claude: { status, body }. */
async function approveUser(uid, caller) {
  const target = validUid(uid) ? (await deps.list()).find((u) => u.uid === uid) : null;
  if (!validUid(uid)) return { status: 400, body: { error: "Missing or invalid user id" } };
  if (!target) return { status: 404, body: { error: "No such user" } };
  await deps.approve(uid, caller.uid);
  console.log("admin-users: approved a user:", uid);
  return { status: 200, body: { ok: true } };
}

/** Why this admin may not delete `uid`: { status, error }, or null when they may. */
function refusal(uid, caller, target) {
  if (!validUid(uid)) return { status: 400, error: "Missing or invalid user id" };
  if (uid === caller.uid) return { status: 400, error: "You cannot delete your own account here" };
  if (!target) return { status: 404, error: "No such user" };
  if (isAdminEmail(target.email)) return { status: 403, error: "That is an admin account" };
  return null;
}

/** Deletes one user for an admin: { status, body }. */
async function deleteUser(uid, caller) {
  const target = validUid(uid) ? (await deps.list()).find((u) => u.uid === uid) : null;
  const refused = refusal(uid, caller, target);
  if (refused) return { status: refused.status, body: { error: refused.error } };
  await deps.remove(uid);
  console.log("admin-users: deleted a user:", uid);
  return { status: 200, body: { ok: true } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "Sign in first" });
  const decoded = await verified(token);
  if (!decoded) return res.status(401).json({ error: "Invalid sign-in" });
  const admin = isAdmin(decoded);
  const action = req.body?.action;
  if (action === "check")
    return res.status(200).json({ admin, approved: admin || (await approvedFor(decoded)) });
  if (!["list", "delete", "approve"].includes(action))
    return res.status(400).json({ error: "Unknown action" });
  if (!admin) return res.status(403).json({ error: "Not an admin" });
  try {
    if (action === "delete" || action === "approve") {
      const act = action === "delete" ? deleteUser : approveUser;
      const out = await act(req.body?.uid, decoded);
      return res.status(out.status).json(out.body);
    }
    const [users, records] = await Promise.all([deps.list(), recordsOrNone()]);
    return res.status(200).json({ users: forCard(users, records) });
  } catch (err) {
    console.error("admin-users error:", err);
    const what =
      { delete: "delete the user", approve: "approve the user" }[action] || "list the users";
    return res.status(500).json({ error: `Could not ${what}` });
  }
}
