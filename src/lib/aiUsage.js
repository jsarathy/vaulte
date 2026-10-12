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

/** The periods the usage table can show. */
export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "1y", label: "Last 1 year" },
  { key: "ytd", label: "Year to date" },
];

/** When a period starts, as an ISO time (the viewer's time zone decides what "today" and "this year" are). */
export function periodStart(key, now = new Date()) {
  const d = new Date(now);
  if (key === "today") d.setHours(0, 0, 0, 0);
  else if (key === "7d") d.setDate(d.getDate() - 7);
  else if (key === "30d") d.setDate(d.getDate() - 30);
  else if (key === "3m") d.setMonth(d.getMonth() - 3);
  else if (key === "1y") d.setFullYear(d.getFullYear() - 1);
  else if (key === "ytd") {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  } else throw new Error(`Unknown period: ${key}`);
  return d.toISOString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (v) => String(v).padStart(2, "0");

/** A record's time for the usage table, in the viewer's time zone: "11 Oct 14:32" ("" if unknown). */
export function whenText(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
