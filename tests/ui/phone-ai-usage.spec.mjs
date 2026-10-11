// tests/ui/phone-ai-usage.spec.mjs — the Claude usage card on a phone (Fix 84, 85): a CLAUDE USAGE
// heading that starts closed, a double tap that opens the table of calls, and the table fitting the
// 390px screen width and scrolling.
import { test, expect } from "./cover.mjs";

const many = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  feature: "create_recipe",
  at: `2026-10-11T08:${String(i).padStart(2, "0")}:00.000Z`,
  input_tokens: 5000,
  output_tokens: 1200,
  cost_usd: 0.053,
}));

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
  await p.addInitScript((rows) => {
    window.__authUser = { uid: "u", email: "jane@example.com" };
    window.__docs = { "users/u": { firstName: "Jane", lastName: "Smith" } };
    window.__collections = { "users/u/ai_usage": rows };
  }, many);
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.locator(".app-sidebar button").nth(1).click();
};

test("CLAUDE USAGE starts closed and opens on tap", async ({ page: p }) => {
  await start(p);
  const head = p.getByRole("button", { name: /CLAUDE USAGE/ });
  await expect(head).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByText("double-tap for every call")).toHaveCount(0);
  await head.click();
  await expect(p.getByText("40 calls · double-tap for every call")).toBeVisible();
  await expect(p.getByText(/^Today \$2\.1200/)).toBeVisible();
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("a double tap opens the table inside the screen width, and it scrolls", async ({
  page: p,
}) => {
  await start(p);
  await p.getByRole("button", { name: /CLAUDE USAGE/ }).click();
  await p.getByText("40 calls").dblclick();
  const dialog = p.getByRole("dialog", { name: "Claude usage" });
  await expect(dialog).toBeVisible();
  const box = await dialog.evaluate((e) => e.getBoundingClientRect().toJSON());
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(390);
  expect(box.bottom).toBeLessThanOrEqual(844);
  // every column is on screen: the table is not wider than the scroll area
  const fit = await dialog
    .locator("div")
    .nth(1)
    .evaluate((e) => ({
      scroll: e.scrollWidth,
      client: e.clientWidth,
      scrollH: e.scrollHeight,
      clientH: e.clientHeight,
    }));
  expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
  expect(fit.scrollH).toBeGreaterThan(fit.clientH); // 40 rows: scrolls down
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});
