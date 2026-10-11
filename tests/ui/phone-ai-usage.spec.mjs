// tests/ui/phone-ai-usage.spec.mjs — the Claude usage card on a phone (Fix 84): a CLAUDE USAGE
// heading that starts closed, opens on tap and stays inside the screen.
import { test, expect } from "./cover.mjs";

test("CLAUDE USAGE starts closed, opens on tap and fits the width", async ({ page: p }) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
  await p.addInitScript(() => {
    window.__authUser = { uid: "u", email: "jane@example.com" };
    window.__docs = { "users/u": { firstName: "Jane", lastName: "Smith" } };
    window.__collections = {
      "users/u/ai_usage": [
        {
          id: "a",
          feature: "create_recipe",
          at: "2026-10-11T08:00:00.000Z",
          input_tokens: 5000,
          output_tokens: 1200,
          cost_usd: 0.053,
        },
      ],
    };
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.locator(".app-sidebar button").nth(1).click();
  const head = p.getByRole("button", { name: /CLAUDE USAGE/ });
  await expect(head).toHaveAttribute("aria-expanded", "false");
  await expect(p.getByText("Today $0.0530")).toHaveCount(0);
  await head.click();
  await expect(p.getByText("Today $0.0530 · 7 days $0.0530 · 30 days $0.0530")).toBeVisible();
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
