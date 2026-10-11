// tests/ui/ai-usage-card.spec.mjs — the Claude usage card on My Account (Fix 84) and the table that
// a double click opens (Fix 85): one row per call with its date, newest first, and the empty and
// failed states. Firebase is mocked.
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
  rec("chat", "2026-08-01T08:00:00.000Z", 9000, 900, 0.9), // older than 30 days: not in the 30-day cost
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

test("the card shows costs for today, 7 and 30 days; a double click opens a table of every call", async ({
  page: p,
}) => {
  await start(p, { __collections: { "users/u/ai_usage": ROWS } });
  await expect(p.getByText("CLAUDE USAGE (YOUR ACCOUNT)")).toBeVisible();
  await expect(p.getByText("Today $0.0165 · 7 days $0.0375 · 30 days $0.0735")).toBeVisible();
  await expect(p.getByText("4 calls · double-click for every call")).toBeVisible();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.getByText("4 calls").dblclick();
  const dialog = p.getByRole("dialog", { name: "Claude usage" });
  await expect(dialog).toContainText("CLAUDE USAGE · 4 CALLS");
  const rows = dialog.getByRole("row");
  await expect(rows).toHaveCount(5); // header + 4 calls
  for (const h of ["Date", "Feature", "In", "Out", "Cost"])
    await expect(rows.first()).toContainText(h);
  await expect(rows.nth(1)).toContainText(/11 Oct \d\d:\d\d\s*chat\s*4000\s*300\s*\$0\.0165/);
  await expect(rows.nth(3)).toContainText(
    /1 Oct \d\d:\d\d\s*create_recipe\s*6000\s*1200\s*\$0\.0360/,
  );
  await expect(rows.nth(4)).toContainText("1 Aug");
});

test("the table closes with Esc, the ✕ button or a click outside it", async ({ page: p }) => {
  await start(p, { __collections: { "users/u/ai_usage": ROWS } });
  const dialog = p.getByRole("dialog");
  const open = async () => {
    await p.getByText("4 calls").dblclick();
    await expect(dialog).toBeVisible();
  };
  await open();
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await open();
  await p.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await open();
  await dialog.click(); // inside: stays open
  await expect(dialog).toBeVisible();
  await p.mouse.click(5, 5); // on the backdrop
  await expect(dialog).toHaveCount(0);
});

test("a call with no known price shows n/a; a single click does not open the table", async ({
  page: p,
}) => {
  await start(p, {
    __collections: { "users/u/ai_usage": [rec("chat", "2026-10-11T08:00:00.000Z", 100, 10, null)] },
  });
  await p.getByText("1 calls").click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.getByText("1 calls").dblclick();
  await expect(p.getByRole("dialog")).toContainText("n/a");
});

test("no records yet: nothing to open", async ({ page: p }) => {
  await start(p, { __collections: { "users/u/ai_usage": [] } });
  await expect(p.getByText("No Claude calls recorded yet.")).toBeVisible();
  await p.getByText("No Claude calls recorded yet.").dblclick();
  await expect(p.getByRole("dialog")).toHaveCount(0);
});

test("records that cannot be read", async ({ page: p }) => {
  await start(p, { __failGetDocs: true });
  await expect(p.getByText("Could not load usage.")).toBeVisible();
  await p.getByText("Could not load usage.").dblclick();
  await expect(p.getByRole("dialog")).toHaveCount(0);
});

test("on a wide screen the table is capped at 720px and scrolls down for many calls", async ({
  page: p,
}) => {
  const at = (i) =>
    `2026-10-${String(11 - (i % 9)).padStart(2, "0")}T08:${String(i).padStart(2, "0")}:00.000Z`;
  const many = Array.from({ length: 60 }, (_, i) => rec("chat", at(i), 4000, 300, 0.0165));
  await start(p, { __collections: { "users/u/ai_usage": many } });
  await p.getByText("60 calls").dblclick();
  const dialog = p.getByRole("dialog");
  const box = await dialog.evaluate((e) => e.getBoundingClientRect().toJSON());
  expect(box.width).toBeLessThanOrEqual(720);
  expect(box.height).toBeLessThanOrEqual(900 * 0.88 + 1);
  const size = await dialog
    .locator("div")
    .nth(1)
    .evaluate((e) => ({ scrollH: e.scrollHeight, clientH: e.clientHeight }));
  expect(size.scrollH).toBeGreaterThan(size.clientH); // more rows than fit: it scrolls
});
