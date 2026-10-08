// tests/ui/phone-shell.spec.mjs — the signed-in page on a phone (Fix 43.4): the Nutrition link
// stays on screen, the tracker fills the space, the five tabs scroll sideways and the calendar
// sidebar sits behind a "Days" button. Desktop keeps its sidebar (no Days button).
import { test, expect } from "@playwright/test";

const signedIn = {
  __authUser: { uid: "u", email: "jane@example.com" },
  __docs: { "users/u": { firstName: "Jane", lastName: "Smith", email: "jane@example.com" } },
};
const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), signedIn);
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible();
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.locator(".nt-root nav")).toBeVisible({ timeout: 10000 });
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const days = (p) => p.getByRole("button", { name: "☰ Days" });

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Nutrition link stays on screen; the tracker fits the width and the height", async ({
    page: p,
  }) => {
    await start(p);
    const bar = await box(p.locator(".app-sidebar"));
    expect(bar.bottom).toBeLessThanOrEqual(844); // not pushed below the window
    expect(bar.top).toBeGreaterThan(500);
    await expect // the page fades in from slightly below; wait for it to settle
      .poll(async () => (await box(p.locator(".nt-root"))).bottom)
      .toBeLessThanOrEqual(bar.top);
    const tracker = await box(p.locator(".nt-root"));
    expect(tracker.right).toBeLessThanOrEqual(390);
    expect(tracker.height).toBeGreaterThan(400); // fills the space between the bars
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("tabs scroll sideways and all five work", async ({ page: p }) => {
    await start(p);
    const nav = p.locator(".nt-root nav");
    expect(await nav.evaluate((e) => getComputedStyle(e).overflowX)).toBe("auto");
    for (const name of ["Compare", "Add entry", "Weight", "Body", "Daily log"]) {
      const tab = nav.getByRole("button", { name, exact: true });
      await tab.scrollIntoViewIfNeeded();
      expect((await box(tab)).height).toBeGreaterThanOrEqual(40); // a thumb-sized target
      await tab.click();
    }
    await expect(p.getByText(/net kcal of/)).toBeVisible();
  });

  test("Days button opens the calendar sidebar; picking a day closes it", async ({ page: p }) => {
    await start(p);
    await expect(p.locator(".nt-root").getByText("Targets · Oct 2026")).toHaveCount(0);
    await days(p).click();
    await expect(p.getByText("Targets · Oct 2026").first()).toBeVisible();
    const drawer = await box(p.getByText("Targets · Oct 2026").first());
    expect(drawer.right).toBeLessThanOrEqual(390);
    await days(p).click();
    await expect(p.getByText("Targets · Oct 2026")).toHaveCount(0);
  });
});

test("desktop: sidebar always shown, no Days button", async ({ page: p }) => {
  await start(p);
  await expect(days(p)).toHaveCount(0);
  await expect(p.getByText("Targets · Oct 2026").first()).toBeVisible();
});
