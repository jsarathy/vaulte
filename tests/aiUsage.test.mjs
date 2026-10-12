// tests/aiUsage.test.mjs — what a Claude call cost and how the records are summed (Fix 41):
// api/_usage/pricing.js, api/_usage/record.js, scripts/ai-usage.mjs, src/api/usageContext.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICES, WEB_SEARCH_USD, costOf } from "../api/_usage/pricing.js";
import { cleanMeta, usageRecord } from "../api/_usage/record.js";
import { format, summarise } from "../scripts/ai-usage.mjs";
import { PERIODS, periodStart, usd, whenText } from "../src/lib/aiUsage.js";
import { setUsageUser, usageField } from "../src/api/usageContext.js";

const MODEL = "claude-sonnet-4-6";

test("pricing: Sonnet 4.6 is $3 in, $15 out, $3.75 cache write, $0.30 cache read per million", () => {
  assert.deepEqual(PRICES[MODEL], { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 });
  assert.equal(WEB_SEARCH_USD, 0.01);
});

test("costOf: tokens at their prices, a web search at a cent each, rounded to 6 places", () => {
  assert.equal(costOf(MODEL, { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 18);
  assert.equal(costOf(MODEL, { input_tokens: 400, output_tokens: 200 }), 0.0042);
  assert.equal(
    costOf(MODEL, { input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000 }),
    6.75,
  );
  assert.equal(costOf(MODEL, { cache_read_input_tokens: 1_000_000 }), 0.3);
  assert.equal(
    costOf(MODEL, {
      input_tokens: 5000,
      output_tokens: 1200,
      server_tool_use: { web_search_requests: 2 },
    }),
    0.053,
  );
  assert.equal(costOf(MODEL, { input_tokens: 1, output_tokens: 1 }), 0.000018);
  assert.equal(costOf(MODEL, {}), 0);
});

test("costOf: no price for a model it does not know, or no usage at all", () => {
  assert.equal(costOf("claude-something-else", { input_tokens: 1000 }), null);
  assert.equal(costOf(undefined, { input_tokens: 1000 }), null);
  assert.equal(costOf(MODEL, undefined), null);
});

test("cleanMeta: a feature name and a user id are kept only when they look right", () => {
  assert.deepEqual(cleanMeta({ feature: "chat", userId: "abc-123_X" }), {
    feature: "chat",
    userId: "abc-123_X",
  });
  assert.deepEqual(cleanMeta({ feature: "parse_food", userId: "u" }), {
    feature: "parse_food",
    userId: "u",
  });
  assert.deepEqual(cleanMeta(undefined), { feature: "unknown", userId: null });
  assert.deepEqual(cleanMeta({ feature: "Chat!", userId: "a/b" }), {
    feature: "unknown",
    userId: null,
  });
  assert.deepEqual(cleanMeta({ feature: "x".repeat(41), userId: "x".repeat(129) }), {
    feature: "unknown",
    userId: null,
  });
  assert.deepEqual(cleanMeta({ feature: "", userId: "" }), { feature: "unknown", userId: null });
  assert.deepEqual(cleanMeta({ feature: 5, userId: 7 }), { feature: "unknown", userId: null });
  assert.deepEqual(cleanMeta({ feature: "a", userId: "../other" }), { feature: "a", userId: null });
});

test("usageRecord: sizes, cost and timing, and nothing of the prompt or reply", () => {
  const rec = usageRecord({
    feature: "create_recipe",
    model: MODEL,
    usage: {
      input_tokens: 5000,
      output_tokens: 1200,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      server_tool_use: { web_search_requests: 2 },
    },
    status: 200,
    stopReason: "end_turn",
    ms: 1234.6,
    at: "2026-10-11T12:00:00.000Z",
  });
  assert.deepEqual(rec, {
    at: "2026-10-11T12:00:00.000Z",
    feature: "create_recipe",
    model: MODEL,
    status: 200,
    stop_reason: "end_turn",
    input_tokens: 5000,
    output_tokens: 1200,
    cache_write_tokens: 10,
    cache_read_tokens: 20,
    web_searches: 2,
    cost_usd: costOf(MODEL, {
      input_tokens: 5000,
      output_tokens: 1200,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      server_tool_use: { web_search_requests: 2 },
    }),
    ms: 1235,
  });
});

test("usageRecord: missing fields become zeros or null; the time defaults to now", () => {
  const rec = usageRecord({ feature: "chat", model: undefined, usage: undefined, status: 500 });
  assert.equal(rec.model, null);
  assert.equal(rec.stop_reason, null);
  assert.equal(rec.input_tokens, 0);
  assert.equal(rec.web_searches, 0);
  assert.equal(rec.cost_usd, null);
  assert.equal(rec.ms, 0);
  assert.match(rec.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("usageContext: the feature and the signed-in user go with every call", () => {
  setUsageUser("u1");
  assert.deepEqual(usageField("chat"), { _usage: { feature: "chat", userId: "u1" } });
  setUsageUser(null);
  assert.deepEqual(usageField("photo"), { _usage: { feature: "photo", userId: null } });
  setUsageUser("");
  assert.equal(usageField("photo")._usage.userId, null);
});

const REC = (feature, user, input, output, cost, at = "2026-10-10T08:00:00.000Z", extra = {}) => ({
  feature,
  user_id: user,
  input_tokens: input,
  output_tokens: output,
  cost_usd: cost,
  web_searches: 0,
  at,
  ...extra,
});

test("summarise: totals, and by feature, user and day with averages, most expensive first", () => {
  const s = summarise([
    REC("chat", "u1", 4000, 300, 0.0165),
    REC("chat", "u2", 5000, 400, 0.021, "2026-10-11T08:00:00.000Z"),
    REC("create_recipe", "u1", 5000, 1200, 0.053, "2026-10-11T09:00:00.000Z", { web_searches: 2 }),
    REC("lookup_food", null, 200, 100, 0.0021),
  ]);
  assert.deepEqual(
    [s.total.calls, s.total.input, s.total.output, s.total.searches],
    [4, 14200, 2000, 2],
  );
  assert.ok(Math.abs(s.total.cost - 0.0926) < 1e-9);
  assert.deepEqual(
    s.byFeature.map((g) => [g.key, g.calls]),
    [
      ["create_recipe", 1],
      ["chat", 2],
      ["lookup_food", 1],
    ],
  );
  const chat = s.byFeature.find((g) => g.key === "chat");
  assert.deepEqual([chat.avgInput, chat.avgOutput], [4500, 350]);
  assert.ok(Math.abs(chat.avgCost - 0.01875) < 1e-9);
  assert.deepEqual(
    s.byUser.map((g) => [g.key, g.calls]),
    [
      ["u1", 2],
      ["u2", 1],
      ["(unattributed)", 1],
    ],
  );
  assert.deepEqual(
    s.byDay.map((g) => [g.key, g.calls]),
    [
      ["2026-10-10", 2],
      ["2026-10-11", 2],
    ],
  );
});

test("summarise: a call with no known price counts, but adds no cost; nothing at all is zeros", () => {
  const s = summarise([REC("chat", "u1", 100, 10, null), REC("chat", "u1", 100, 10, 0.5)]);
  assert.equal(s.total.calls, 2);
  assert.equal(s.total.unpriced, 1);
  assert.equal(s.total.cost, 0.5);
  const none = summarise([]);
  assert.deepEqual([none.total.calls, none.total.cost, none.byFeature], [0, 0, []]);
  assert.equal(
    summarise([{ cost_usd: 1, at: "2026-10-10T00:00:00Z" }]).byFeature[0].key,
    "unknown",
  );
});

test("format: plain text tables with the totals first", () => {
  const text = format(
    summarise([REC("chat", "u1", 4000, 300, 0.0165), REC("lookup_food", "u2", 200, 100, null)]),
  );
  assert.match(text, /^2 calls, 4200 tokens in, 400 out, 0 web searches, \$0\.0165/);
  assert.match(text, /\(1 calls on a model with no known price are not in the cost\)/);
  assert.match(text, /feature +calls +avg in +avg out +avg cost +total/);
  assert.match(text, /chat +1 +4000 +300 +\$0\.0165 +\$0\.0165/);
  assert.match(text, /user +calls +total/);
  assert.match(text, /day +calls +total/);
});

test("PERIODS: today, 7 days, 30 days, 3 months, 1 year, year to date, in that order", () => {
  assert.deepEqual(
    PERIODS.map((p) => [p.key, p.label]),
    [
      ["today", "Today"],
      ["7d", "Last 7 days"],
      ["30d", "Last 30 days"],
      ["3m", "Last 3 months"],
      ["1y", "Last 1 year"],
      ["ytd", "Year to date"],
    ],
  );
});

test("periodStart: where each period begins, in the viewer's time zone", () => {
  process.env.TZ = "UTC";
  const now = new Date("2026-10-12T15:30:45.123Z");
  assert.equal(periodStart("today", now), "2026-10-12T00:00:00.000Z");
  assert.equal(periodStart("7d", now), "2026-10-05T15:30:45.123Z");
  assert.equal(periodStart("30d", now), "2026-09-12T15:30:45.123Z");
  assert.equal(periodStart("3m", now), "2026-07-12T15:30:45.123Z");
  assert.equal(periodStart("1y", now), "2025-10-12T15:30:45.123Z");
  assert.equal(periodStart("ytd", now), "2026-01-01T00:00:00.000Z");
  assert.equal(now.toISOString(), "2026-10-12T15:30:45.123Z"); // the date passed in is not changed
  process.env.TZ = "Asia/Kolkata"; // 05:30 ahead: local midnight is the evening before in UTC
  assert.equal(periodStart("today", now), "2026-10-11T18:30:00.000Z");
  assert.equal(periodStart("ytd", now), "2025-12-31T18:30:00.000Z");
  process.env.TZ = "UTC";
  assert.throws(() => periodStart("forever", now), /Unknown period: forever/);
  assert.match(periodStart("today"), /^\d{4}-\d{2}-\d{2}T/); // no date given: now
});

test("usd: dollars to four places", () => {
  assert.equal(usd(0.0165), "$0.0165");
  assert.equal(usd(0), "$0.0000");
});

test("whenText: day, month and time in the viewer's time zone; blank when unknown", () => {
  process.env.TZ = "UTC";
  assert.equal(whenText("2026-10-11T14:32:00.000Z"), "11 Oct 14:32");
  assert.equal(whenText("2026-01-02T03:04:00.000Z"), "2 Jan 03:04");
  assert.equal(whenText("2026-12-31T23:59:00.000Z"), "31 Dec 23:59");
  const names = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  names.forEach((m, i) => {
    const iso = `2026-${String(i + 1).padStart(2, "0")}-15T09:05:00.000Z`;
    assert.equal(whenText(iso), `15 ${m} 09:05`);
  });
  process.env.TZ = "Asia/Kolkata";
  assert.equal(whenText("2026-10-11T22:00:00.000Z"), "12 Oct 03:30");
  process.env.TZ = "UTC";
  assert.equal(whenText(""), "");
  assert.equal(whenText(undefined), "");
  assert.equal(whenText("not a date"), "");
});
