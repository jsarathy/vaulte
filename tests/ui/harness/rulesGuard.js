// tests/ui/harness/rulesGuard.js — what firestore.rules and storage.rules let the app do, read from
// the real rule files (Fix 124). The UI test harness checks every Firestore and Storage call the
// code makes against this, so a feature that uses a collection or file path the rules do not list,
// or writes where the rules forbid it, fails CI instead of failing for the first person who uses it.
// It reads the shape the rules are written in (one `match` per collection with `allow` lines); it is
// not a rules engine, and tests/api/firestore-rules.test.mjs runs the real rules in the emulator.

const OPS = { read: ["get", "list"], write: ["create", "update", "delete"] };
const expand = (op) => OPS[op] || [op];
const withoutComments = (text) => text.replace(/\/\/.*$/gm, "");

/** The operations an `allow a, b: if …;` line names, and the document it is limited to (if any). */
function parseAllow(line) {
  const named = /allow\s+([a-z, ]+?)\s*:\s*if\s+(.*?);/.exec(line);
  if (!named) return null;
  const ops = named[1].split(",").flatMap((op) => expand(op.trim()));
  const only = /\b\w+\s*==\s*"([^"]+)"/.exec(named[2]);
  return { ops, only: only ? only[1] : null };
}

const allowsIn = (body) =>
  body
    .split(/(?<=;)/)
    .map(parseAllow)
    .filter(Boolean);

/** The text between the braces of the block that opens at or after `from`. */
function blockFrom(text, from) {
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    depth += text[i] === "{" ? 1 : text[i] === "}" ? -1 : 0;
    if (depth === 0) return text.slice(open + 1, i);
  }
  return "";
}

/** { profile, collections }: the operations on the user's own document, and for each collection
 *  under users/{uid} the operations allowed (with the one document they are limited to, if any). */
export function parseFirestoreRules(text) {
  const rules = withoutComments(text);
  const header = /match\s+\/users\/\{\w+\}/.exec(rules);
  const users = header ? blockFrom(rules, header.index + header[0].length) : "";
  const profile = allowsIn(users.split(/match\s/)[0]);
  const collections = {};
  for (const m of users.matchAll(/match\s+\/([A-Za-z_]+)\/\{\w+\}\s*\{([^{}]*)\}/g)) {
    collections[m[1]] = allowsIn(m[2]);
  }
  return { profile, collections };
}

const permits = (allows, op, docId) =>
  allows.some((a) => a.ops.includes(op) && (a.only === null || a.only === docId));

/** { ok, why } for `op` (get, list, create, update, delete) on a Firestore path such as
 *  "users/u/recipes/r1". The user id segment is not checked here: the harness is one signed-in person. */
export function firestoreAllows(parsed, op, path) {
  const parts = String(path).split("/").filter(Boolean);
  if (parts[0] !== "users" || parts.length < 2) return { ok: false, why: "not under users/{uid}" };
  if (parts.length === 2)
    return verdict(permits(parsed.profile, op, parts[1]), "the profile document");
  const allows = parsed.collections[parts[2]];
  if (!allows) return { ok: false, why: `no rule for "${parts[2]}"` };
  return verdict(permits(allows, op, parts[3] ?? null), `"${parts[2]}"`);
}

const verdict = (ok, what) => ({ ok, why: ok ? "" : `the rules do not allow this on ${what}` });

/** { folders, maxBytes }: the folders storage.rules opens (with a `{file}` match) and the size limit. */
export function parseStorageRules(text) {
  const rules = withoutComments(text);
  const folders = [...rules.matchAll(/match\s+\/([A-Za-z0-9_-]+)\/\{file\}/g)].map((m) => m[1]);
  const size = /request\.resource\.size\s*<\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(rules);
  return { folders, maxBytes: size ? Number(size[1]) * 1024 * 1024 : Infinity };
}

/** { ok, why } for a Storage upload of `file` ({ size, type }) to `path` ("profile-photos/uid.jpg"). */
export function storageAllowsUpload(parsed, path, file) {
  const [folder, name, ...rest] = String(path).split("/");
  if (!parsed.folders.includes(folder) || !name || rest.length) {
    return { ok: false, why: `no Storage rule for "${path}"` };
  }
  if (file?.size >= parsed.maxBytes) return { ok: false, why: "larger than the rules allow" };
  if (!String(file?.type || "").startsWith("image/")) return { ok: false, why: "not an image" };
  return { ok: true, why: "" };
}

/** { ok, why } for reading, deleting or asking the address of a Storage file. */
export function storageAllowsAccess(parsed, path) {
  const [folder, name, ...rest] = String(path).split("/");
  const ok = parsed.folders.includes(folder) && Boolean(name) && !rest.length;
  return { ok, why: ok ? "" : `no Storage rule for "${path}"` };
}
