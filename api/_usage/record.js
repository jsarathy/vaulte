// api/_usage/record.js — the record kept for one Claude call (Fix 41): which feature, how many
// tokens, what it cost. Never the prompt or the reply: Vaulte holds health data, and the sizes are
// all the cost question needs.
import { costOf } from "./pricing.js";

/** { feature, userId } from the client's `_usage` field, each checked; anything odd is dropped. */
export function cleanMeta(raw) {
  const feature =
    typeof raw?.feature === "string" && /^[a-z_]{1,40}$/.test(raw.feature)
      ? raw.feature
      : "unknown";
  const id = raw?.userId;
  const userId = typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
  return { feature, userId };
}

const n = (v) => v || 0;

/** The stored record for a call: `usage` is the API's own usage object. */
export function usageRecord({ feature, model, usage, status, stopReason, ms, at }) {
  const u = usage ?? {};
  return {
    at: at || new Date().toISOString(),
    feature,
    model: model || null,
    status,
    stop_reason: stopReason || null,
    input_tokens: n(u.input_tokens),
    output_tokens: n(u.output_tokens),
    cache_write_tokens: n(u.cache_creation_input_tokens),
    cache_read_tokens: n(u.cache_read_input_tokens),
    web_searches: n(u.server_tool_use?.web_search_requests),
    cost_usd: costOf(model, usage),
    ms: Math.round(n(ms)),
  };
}
