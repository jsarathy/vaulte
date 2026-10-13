// api/claude.js — server-side proxy to the Anthropic Messages API, so the API key never
// reaches the browser. It also keeps a record of each call's size and cost (Fix 41): the browser
// adds a `_usage: { feature }` field, which is taken off before the request is forwarded. Only a
// signed-in person may call it (their Firebase ID token, Fix 118), and the usage is recorded for
// the user in that token.
import { accessOf } from "./_admin/access.js";
import { callerOf } from "./_admin/caller.js";
import { verifyIdToken } from "./_admin/verify.js";
import { cleanMeta, usageRecord } from "./_usage/record.js";
import { saveUsage } from "./_usage/store.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// The token check and the approval check; a test replaces them (as in infra-status.js).
export const deps = { verify: verifyIdToken, access: accessOf };

// Each web search result carries an `encrypted_content` blob, needed only to
// resume a multi-turn conversation that includes that search. This app makes
// single-shot requests, so we strip it here — across a few searches with
// several results each, these blobs can push the response past Vercel's
// 4.5MB function response limit, which crashes the invocation (500
// FUNCTION_INVOCATION_FAILED) *before* our catch block ever runs, since it's
// enforced by the platform rather than raised as a JS error.
const stripBlock = (block) =>
  block.type === "web_search_tool_result" && Array.isArray(block.content)
    ? { ...block, content: block.content.map(({ encrypted_content, ...rest }) => rest) }
    : block;

export function stripSearchBlobs(data) {
  if (!Array.isArray(data.content)) return data;
  return { ...data, content: data.content.map(stripBlock) };
}

const forwardToAnthropic = (body, apiKey) =>
  fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

// Best effort: a record that cannot be saved never fails the call itself.
async function logUsage({ meta, request, response, data, started }) {
  if (!data?.usage) return;
  try {
    const record = usageRecord({
      feature: meta.feature,
      model: request?.model,
      usage: data.usage,
      status: response.status,
      stopReason: data.stop_reason,
      ms: Date.now() - started,
    });
    await saveUsage(meta.userId, record);
  } catch (err) {
    console.error("ai usage not saved:", err.message);
  }
}

/** 403 for a person whose email address is not confirmed (Fix 126); the header lets the app tell
 *  this apart from any other 403 and ask them to confirm. */
function refuseUnconfirmed(res) {
  res.setHeader("X-Vaulte-Reason", "email_not_confirmed");
  return res
    .status(403)
    .json({ error: "Confirm your email address to use Claude.", code: "email_not_confirmed" });
}

/** 403 for a confirmed person the owner has not approved yet (Fix 134). */
function refuseNotApproved(res) {
  res.setHeader("X-Vaulte-Reason", "not_approved");
  return res
    .status(403)
    .json({ error: "Your access to Claude is waiting for approval.", code: "not_approved" });
}

/** Whether this caller may use Claude; null if that could not be found out. */
async function mayUse(claims) {
  try {
    return (await deps.access(claims)).approved === true;
  } catch (err) {
    console.error("claude: access check failed:", err.message);
    return null;
  }
}

/** The refusal already sent for a caller who may not use Claude (email not confirmed, not approved, or
 *  access unknown), or null when they may. */
async function refuseIfNotAllowed(claims, res) {
  if (claims.email_verified !== true) return refuseUnconfirmed(res);
  const may = await mayUse(claims);
  if (may === null) return res.status(500).json({ error: "Could not check your access" });
  return may ? null : refuseNotApproved(res);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const caller = await callerOf(req, deps.verify);
  if (caller.error) return res.status(caller.error.status).json(caller.error.body);
  const turnedAway = await refuseIfNotAllowed(caller.claims, res);
  if (turnedAway) return turnedAway;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  try {
    const { _usage, ...request } = req.body ?? {};
    const started = Date.now();
    const response = await forwardToAnthropic(request, apiKey);
    const data = await response.json();
    const meta = { ...cleanMeta(_usage), userId: caller.uid }; // who, from the token
    await logUsage({ meta, request, response, data, started });
    return res.status(response.status).json(stripSearchBlobs(data));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
