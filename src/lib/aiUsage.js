// src/lib/aiUsage.js — Claude usage records summed up (Fix 41, 84): totals, and per feature, user
// and day. Used by the My Account usage card and by scripts/ai-usage.mjs.

const r2 = (n) => Math.round(n * 100) / 100;
export const usd = (n) => `$${n.toFixed(4)}`;

function group(records, keyOf) {
  const out = new Map();
  for (const rec of records) {
    const key = keyOf(rec);
    const g = out.get(key) || {
      key,
      calls: 0,
      input: 0,
      output: 0,
      searches: 0,
      cost: 0,
      unpriced: 0,
    };
    g.calls += 1;
    g.input += rec.input_tokens || 0;
    g.output += rec.output_tokens || 0;
    g.searches += rec.web_searches || 0;
    if (rec.cost_usd == null) g.unpriced += 1;
    else g.cost += rec.cost_usd;
    out.set(key, g);
  }
  return [...out.values()];
}

/** The records summed up: totals, and per feature, user and day (most expensive first). */
export function summarise(records) {
  const rows = (keyOf, sort) =>
    group(records, keyOf)
      .map((g) => ({
        ...g,
        avgInput: r2(g.input / g.calls),
        avgOutput: r2(g.output / g.calls),
        avgCost: g.cost / g.calls,
      }))
      .sort(sort);
  const byCost = (a, b) => b.cost - a.cost;
  return {
    total: group(records, () => "all")[0] || {
      calls: 0,
      input: 0,
      output: 0,
      searches: 0,
      cost: 0,
      unpriced: 0,
    },
    byFeature: rows((r) => r.feature || "unknown", byCost),
    byUser: rows((r) => r.user_id || r.uid || "(unattributed)", byCost),
    byDay: rows(
      (r) => String(r.at || "").slice(0, 10),
      (a, b) => (a.key < b.key ? -1 : 1),
    ),
  };
}

const DAY = 86400000;

/** Cost of the records from the last 1, 7 and 30 days (a record with no known price adds 0). */
export function periodCosts(records, now = Date.now()) {
  const within = (days) =>
    records
      .filter((r) => String(r.at || "") >= new Date(now - days * DAY).toISOString())
      .reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  return { day: within(1), week: within(7), month: within(30) };
}
