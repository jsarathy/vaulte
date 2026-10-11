// api/claude.js — server-side proxy to the Anthropic Messages API, so the API key never
// reaches the browser. It also keeps a record of each call's size and cost (Fix 41): the browser
// adds a `_usage: { feature, userId }` field, which is taken off before the request is forwarded.
import { cleanMeta, usageRecord } from "./_usage/record.js";
import { saveUsage } from "./_usage/store.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  try {
    const { _usage, ...request } = req.body ?? {};
    const started = Date.now();
    const response = await forwardToAnthropic(request, apiKey);
    const data = await response.json();
    await logUsage({ meta: cleanMeta(_usage), request, response, data, started });
    return res.status(response.status).json(stripSearchBlobs(data));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
