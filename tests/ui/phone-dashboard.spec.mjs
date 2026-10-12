// tests/ui/phone-dashboard.spec.mjs — the Dashboard on a phone (Fix 98): reached from the bottom
// navigation, the rows fit the 390px width, and one tap on CLAUDE USAGE opens the usage table.
import { test, expect } from "./cover.mjs";

test("the Dashboard fits the phone; one tap on CLAUDE USAGE opens the table", async ({
  page: p,
}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date(2026, 9, 11, 12, 0, 0));
  await p.addInitScript(() => {
    window.__authUser = { uid: "u", email: "jane@example.com" };
    window.__docs = {
      "users/u": { firstName: "Jane", lastName: "Smith" },
      "users/u/polar/connection": { connected: true, last_sync_at: "2026-10-11T09:00:00.000Z" },
    };
    window.__collections = {
      "users/u/apple_activity": [],
      "users/u/weight_log": [{ id: "2026-10-10", date: "2026-10-10" }],
      "users/u/body_log": [],
      "users/u/ai_usage": [
        {
          id: "a",
          feature: "chat",
          at: "2026-10-11T08:00:00.000Z",
          input_tokens: 4000,
          output_tokens: 300,
          cost_usd: 0.0165,
        },
      ],
    };
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.locator(".app-sidebar button").nth(3).click(); // Home, My Account, Nutrition, Dashboard
  await expect(p.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  for (const id of ["polar", "apple", "weight", "body"]) {
    const box = await p
      .locator(`[data-app="${id}"]`)
      .evaluate((e) => e.getBoundingClientRect().toJSON());
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
  }
  await expect(p.locator('[data-app="weight"]')).toContainText("Last reading yesterday");
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await p.getByRole("button", { name: /CLAUDE USAGE/ }).click();
  await expect(p.getByRole("dialog", { name: "Claude usage" })).toContainText("1.65¢");
});
