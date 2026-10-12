// tests/ui/phone-dashboard.spec.mjs — the Dashboard on a phone (Fix 98, 99): reached from the bottom
// navigation; three rubrics (YOUR APPS, CLAUDE, INFRASTRUCTURE); a tap opens that box as a popup
// that fills the window, in larger type; Claude's opens the usage table.
import { test, expect } from "./cover.mjs";

const SCREEN = { width: 390, height: 844 };

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date(2026, 9, 11, 12, 0, 0));
  await p.addInitScript(() => {
    window.__authUser = { uid: "u", email: "jane@example.com" };
    window.__docs = {
      "users/u": { firstName: "Jane", lastName: "Smith" },
      "users/u/polar/connection": {
        connected: true,
        last_sync_at: new Date(2026, 9, 11, 9, 0, 0).toISOString(), // 3 hours before "now"
      },
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
};
const rubric = (p, name) => p.getByRole("button", { name, exact: true });
const rect = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));

test("three rubrics, nothing else, each inside the screen", async ({ page: p }) => {
  await start(p);
  for (const name of ["YOUR APPS", "CLAUDE", "INFRASTRUCTURE"]) {
    await expect(rubric(p, name)).toBeVisible();
    const b = await rect(rubric(p, name));
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(SCREEN.width);
    expect(b.height).toBeGreaterThanOrEqual(56); // a comfortable tap
  }
  await expect(p.locator("[data-app]")).toHaveCount(0); // the cards are not open
  await expect(p.getByRole("dialog")).toHaveCount(0);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("YOUR APPS opens as a popup that fills the window, in large type; ✕ and Esc close it", async ({
  page: p,
}) => {
  await start(p);
  await rubric(p, "YOUR APPS").click();
  const dialog = p.getByRole("dialog", { name: "YOUR APPS" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog);
  expect([b.left, b.top, b.right, b.bottom]).toEqual([0, 0, SCREEN.width, SCREEN.height]);
  await expect(dialog.locator("[data-app]")).toHaveCount(4);
  await expect(dialog.locator('[data-app="weight"]')).toContainText("Last reading yesterday");
  await expect(dialog.locator('[data-app="polar"]')).toContainText("Last sync 3 hours ago");
  expect(await size(dialog.locator('[data-app="polar"] div div').first())).toBeGreaterThanOrEqual(
    22,
  );
  expect(await size(dialog.locator('[data-app="polar"] div div').nth(1))).toBeGreaterThanOrEqual(
    17,
  );
  for (const id of ["polar", "apple", "weight", "body"]) {
    const row = await rect(dialog.locator(`[data-app="${id}"]`));
    expect(row.left).toBeGreaterThanOrEqual(0);
    expect(row.right).toBeLessThanOrEqual(SCREEN.width);
  }
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await rubric(p, "YOUR APPS").click();
  await expect(dialog).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("INFRASTRUCTURE opens as a popup with the links in large type", async ({ page: p }) => {
  await start(p);
  await rubric(p, "INFRASTRUCTURE").click();
  const dialog = p.getByRole("dialog", { name: "INFRASTRUCTURE" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog);
  expect([b.left, b.top, b.right, b.bottom]).toEqual([0, 0, SCREEN.width, SCREEN.height]);
  const links = dialog.getByRole("link");
  await expect(links).toHaveText([
    "Vercel",
    "Firebase",
    "GitHub",
    "GitHub Actions",
    "GitHub issues",
    "Anthropic Console",
  ]);
  expect(await size(links.first())).toBeGreaterThanOrEqual(22);
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("CLAUDE opens the usage table", async ({ page: p }) => {
  await start(p);
  await rubric(p, "CLAUDE").click();
  await expect(p.getByRole("dialog", { name: "Claude usage" })).toContainText("1.65¢");
  await p.getByRole("button", { name: "Close" }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
});
