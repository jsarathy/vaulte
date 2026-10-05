// api/_apple/request.js — the parts of a POST /api/apple-sync request that need checking before
// anything is stored: the bearer token, the body (object, JSON text or Buffer) and the date.
import { timingSafeEqual } from "crypto";
import { parseLoose, todayUK } from "./time.js";

/** Constant-time check of the Authorization: Bearer token against APPLE_SYNC_TOKEN. */
export function tokenOk(req) {
  const expected = process.env.APPLE_SYNC_TOKEN || "";
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** The body as an object ({} when empty); null when it is text that is not JSON. */
export function parseBody(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : raw;
  if (typeof text !== "string") return text || {};
  try {
    return JSON.parse(text) || {};
  } catch {
    return null;
  }
}

/**
 * The day being synced: the first YYYY-MM-DD in the value, else Shortcuts' date text ("Sep 26,
 * 2026", "26 Sep 2026", "26/09/2026" — so a backfill never lands on today by mistake), else
 * today in UK time when no date was sent. null for a date that cannot be read.
 */
export function resolveDate(raw) {
  const iso = /\d{4}-\d{2}-\d{2}/.exec(String(raw ?? ""));
  if (iso) return iso[0];
  const loose = parseLoose(`${raw ?? ""} 12:00`);
  if (loose) return loose.date;
  return raw ? null : todayUK();
}

/** The first reason to refuse the request as { status, error }, or null when it can proceed. */
export function rejection(req) {
  if (req.method !== "POST") return { status: 405, error: "Method not allowed" };
  if (!tokenOk(req)) return { status: 401, error: "Unauthorized" };
  if (!process.env.APPLE_SYNC_USER_ID)
    return { status: 500, error: "APPLE_SYNC_USER_ID not configured" };
  return null;
}
