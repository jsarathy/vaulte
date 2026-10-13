// src/lib/userTable.js — the Users table (Dashboard, Fix 104): its columns, how a user is shown in
// them, and the search over them.
import { whenText } from "./aiUsage.js";

export const USER_COLUMNS = [
  "Name",
  "Email",
  "Phone",
  "Member since",
  "Last sign-in",
  "Sign-in",
  "Member ID",
  "User ID",
  "Claude",
];

const PROVIDERS = { "google.com": "Google", password: "Email and password", phone: "Phone" };

/** "Google, Email and password": the sign-in methods of a user, named for people. */
export const providersText = (providers) =>
  (providers || []).map((p) => PROVIDERS[p] || p).join(", ");

const APPROVAL = { approved: "Approved", pending: "Waiting" };

/** Whether a user may use Claude, in words: "Approved", "Waiting", or "" when they have not asked yet. */
export const approvalText = (approval) => APPROVAL[approval] || "";

/** A user as the cells of one row, in the order of USER_COLUMNS. */
export const userCells = (u) => [
  u.name || "",
  u.email || "",
  u.phone || "",
  whenText(u.created),
  whenText(u.last_sign_in),
  providersText(u.providers) + (u.disabled ? " (disabled)" : ""),
  u.member_id || "",
  u.uid || "",
  approvalText(u.approval),
];

/** The users whose row (name, email, phone, address, dates, ids…) contains every word typed, in any case. */
export function filterUsers(users, query) {
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return users;
  return users.filter((u) => {
    const text = [...userCells(u), u.address || ""].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** "1 user" or "3 users". */
export const usersCount = (n) => `${n} user${n === 1 ? "" : "s"}`;

/** Whether the Users table offers to delete this user: not an admin, and not the person looking. */
export const canDelete = (u, myUid) => !u.admin && u.uid !== myUid;

/** Whether the table offers Approve: only for a person who is waiting. */
export const canApprove = (u) => u.approval === "pending";

/** What the confirmation says before a user is deleted. */
export function deleteConfirmText(u) {
  const who = u.email || u.name || u.uid;
  return (
    `Delete ${who}?

This removes their login, their profile photo and everything they saved ` +
    "(food log, weights, recipes, chat, Polar and Renpho data). It cannot be undone."
  );
}
