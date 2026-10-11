// api/_usage/pricing.js — what a Claude call cost, from the `usage` the API reports (Fix 41).
// Anthropic's list prices in USD per million tokens (checked 2026-10-11 against
// platform.claude.com/docs/en/about-claude/pricing); a model not listed has no cost (null) rather
// than a guess. Web search is billed per search on top of the tokens its results use.

export const PRICES = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};
export const WEB_SEARCH_USD = 0.01; // $10 per 1,000 searches

const per = (tokens, usdPerMillion) => ((tokens || 0) * usdPerMillion) / 1e6;

/** The cost in USD (to 6 decimals) of one call's usage, or null when the model's price is not known. */
export function costOf(model, usage) {
  const p = PRICES[model];
  if (!p || !usage) return null;
  const searches = usage.server_tool_use?.web_search_requests || 0;
  const usd =
    per(usage.input_tokens, p.input) +
    per(usage.output_tokens, p.output) +
    per(usage.cache_creation_input_tokens, p.cacheWrite) +
    per(usage.cache_read_input_tokens, p.cacheRead) +
    searches * WEB_SEARCH_USD;
  return Math.round(usd * 1e6) / 1e6;
}
