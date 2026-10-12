// tests/ui/phone-ai-usage.spec.mjs — the Claude usage table on a phone (Fix 84–87): one tap on
// CLAUDE USAGE opens it, it uses the screen and fits the 390px width, with its filters, and scrolls.
import { test, expect } from "./cover.mjs";
import { fontsReady } from "./fonts.mjs";

const many = Array.from({ length: 40 }, (_, i) => ({
  id: `r${i}`,
  feature: i % 2 ? "create_recipe" : "chat",
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
  await p.locator(".app-sidebar button").nth(3).click(); // Dashboard
  await p.getByRole("button", { name: "CLAUDE", exact: true }).click(); // its Claude popup
};

const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));

test("one tap on CLAUDE USAGE opens a table that fills the screen width, filters and scrolls", async ({
  page: p,
}) => {
  await start(p);
  const head = p.getByRole("button", { name: /Claude Usage/i });
  await expect(head).toBeVisible();
  await expect(p.getByRole("dialog", { name: "Claude usage" })).toHaveCount(0);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await head.click();
  const dialog = p.getByRole("dialog", { name: "Claude usage" });
  await expect(dialog).toBeVisible();
  const box = await dialog.evaluate((e) => e.getBoundingClientRect().toJSON());
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(390);
  expect(box.width).toBeGreaterThan(370); // nearly the full width
  expect(box.height).toBeGreaterThan(844 * 0.9); // and nearly the full height
  expect(box.bottom).toBeLessThanOrEqual(844);
  // the filters are on screen
  for (const name of ["Period", "Feature", "Close"]) {
    const b = await dialog
      .getByLabel(name)
      .first()
      .evaluate((e) => e.getBoundingClientRect().toJSON());
    expect(b.right).toBeLessThanOrEqual(390);
    expect(b.left).toBeGreaterThanOrEqual(0);
  }
  await fontsReady(p); // the table is only as wide as the web font makes it
  // every column is on screen: the table is not wider than the scroll area
  const fit = await dialog
    .locator("table")
    .locator("xpath=..")
    .evaluate((e) => ({
      scroll: e.scrollWidth,
      client: e.clientWidth,
      scrollH: e.scrollHeight,
      clientH: e.clientHeight,
    }));
  expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
  expect(fit.scrollH).toBeGreaterThan(fit.clientH); // 40 rows: scrolls down
  // the summary at the bottom is large; the headings are centred and the cells bordered
  expect(await size(dialog.getByText(/^\d+ calls · /))).toBeGreaterThanOrEqual(19);
  const heads = dialog.getByRole("columnheader");
  expect(await heads.evaluateAll((hs) => hs.map((h) => getComputedStyle(h).textAlign))).toEqual(
    Array(5).fill("center"),
  );
  expect(
    await dialog
      .getByRole("cell")
      .first()
      .evaluate((e) => getComputedStyle(e).borderTopWidth),
  ).toBe("1px");
  await dialog.getByLabel("Feature").selectOption("chat");
  await expect(dialog.getByRole("row")).toHaveCount(21); // header + 20 chat calls
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});
