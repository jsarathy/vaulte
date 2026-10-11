// tests/ui/ai-usage-card.spec.mjs — the Claude usage card on My Account (Fix 84): cost for today,
// 7 and 30 days, the last 30 days by feature, and the empty and failed states. Firebase is mocked.
import { test, expect } from "./cover.mjs";

const rec = (feature, at, input, output, cost) => ({
  id: at + feature,
  feature,
  at,
  input_tokens: input,
  output_tokens: output,
  cost_usd: cost,
});
const ROWS = [
  rec("chat", "2026-10-11T08:00:00.000Z", 4000, 300, 0.0165),
  rec("chat", "2026-10-09T08:00:00.000Z", 5000, 400, 0.021),
  rec("create_recipe", "2026-10-01T08:00:00.000Z", 6000, 1200, 0.036),
  rec("chat", "2026-08-01T08:00:00.000Z", 9000, 900, 0.9), // older than 30 days: left out
];

const start = async (p, init) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
  await p.addInitScript((i) => Object.assign(window, i), {
    __authUser: { uid: "u", email: "jane@example.com" },
    __docs: { "users/u": { firstName: "Jane", lastName: "Smith", email: "jane@example.com" } },
    ...init,
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.locator(".app-sidebar button").nth(1).click();
  await expect(p.getByRole("heading", { name: "My Account" })).toBeVisible();
};

test("costs for today, 7 and 30 days and a row per feature", async ({ page: p }) => {
  await start(p, { __collections: { "users/u/ai_usage": ROWS } });
  await expect(p.getByText("CLAUDE USAGE (YOUR ACCOUNT)")).toBeVisible();
  await expect(p.getByText("Today $0.0165 · 7 days $0.0375 · 30 days $0.0735")).toBeVisible();
  await expect(p.getByText("3 calls, 15000 tokens in, 1900 out in the last 30 days")).toBeVisible();
  const chat = p.getByRole("row", { name: /^chat/ });
  await expect(chat).toContainText("2");
  await expect(chat).toContainText("$0.0188");
  await expect(chat).toContainText("$0.0375");
  await expect(p.getByRole("row", { name: /^create_recipe/ })).toContainText("$0.0360");
});

test("no records yet", async ({ page: p }) => {
  await start(p, { __collections: { "users/u/ai_usage": [] } });
  await expect(p.getByText("No Claude calls recorded yet.")).toBeVisible();
});

test("records that cannot be read", async ({ page: p }) => {
  await start(p, { __failGetDocs: true });
  await expect(p.getByText("Could not load usage.")).toBeVisible();
});
