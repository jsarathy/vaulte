// scripts/ai-usage.mjs — what the Claude calls used and cost, per feature and per user (Fix 41).
// Usage: npm run ai-usage [-- --days 30]
// Reads users/{uid}/ai_usage (all users) and ai_usage_unattributed with Firebase Admin: needs
// FIREBASE_SERVICE_ACCOUNT (the same JSON the API functions use) in the environment, or
// FIRESTORE_EMULATOR_HOST for a local emulator. Records hold sizes and costs only, never prompts.
import { fileURLToPath } from "node:url";

const r2 = (n) => Math.round(n * 100) / 100;
const usd = (n) => `$${n.toFixed(4)}`;

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

const pad = (v, n) => String(v).padEnd(n);
const num = (v, n) => String(v).padStart(n);

/** The summary as plain text tables. */
export function format(s) {
  const lines = [];
  const t = s.total;
  lines.push(
    `${t.calls} calls, ${t.input} tokens in, ${t.output} out, ${t.searches} web searches, ${usd(t.cost)}`,
  );
  if (t.unpriced)
    lines.push(`(${t.unpriced} calls on a model with no known price are not in the cost)`);
  lines.push(
    "",
    `${pad("feature", 20)}${num("calls", 6)}${num("avg in", 9)}${num("avg out", 9)}${num("avg cost", 11)}${num("total", 11)}`,
  );
  for (const g of s.byFeature)
    lines.push(
      `${pad(g.key, 20)}${num(g.calls, 6)}${num(g.avgInput, 9)}${num(g.avgOutput, 9)}${num(usd(g.avgCost), 11)}${num(usd(g.cost), 11)}`,
    );
  lines.push("", `${pad("user", 30)}${num("calls", 6)}${num("total", 11)}`);
  for (const g of s.byUser)
    lines.push(`${pad(g.key, 30)}${num(g.calls, 6)}${num(usd(g.cost), 11)}`);
  lines.push("", `${pad("day", 12)}${num("calls", 6)}${num("total", 11)}`);
  for (const g of s.byDay) lines.push(`${pad(g.key, 12)}${num(g.calls, 6)}${num(usd(g.cost), 11)}`);
  return lines.join("\n");
}

async function load(days) {
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: "demo-vaulte" });
    else
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")) });
  }
  const db = getFirestore();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  // no date filter in the query: a filter across every user's records needs an index set up first
  const [mine, loose] = await Promise.all([
    db.collectionGroup("ai_usage").get(),
    db.collection("ai_usage_unattributed").get(),
  ]);
  const withUser = mine.docs.map((d) => ({ ...d.data(), user_id: d.ref.parent.parent.id }));
  return [...withUser, ...loose.docs.map((d) => d.data())].filter((r) => r.at >= since);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--days");
  const days = i > 0 ? Number(process.argv[i + 1]) || 30 : 30;
  console.log(`Claude usage, last ${days} days\n`);
  console.log(format(summarise(await load(days))));
}
