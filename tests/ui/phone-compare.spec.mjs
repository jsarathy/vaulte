// tests/ui/phone-compare.spec.mjs — the Compare tab on a phone (Fix 43.8), at 390 x 844 in the
// signed-in page: the five days scroll sideways (150 px each), the Reference calculator sits
// full-width under them, and nothing else sticks out past the right edge.
import { test, expect } from "@playwright/test";

const DAYS = ["2026-10-04", "2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30"].map(
  (date, i) => ({
    date,
    notes: "",
    meals: [
      { id: "m" + i, name: "Lunch", items: [{ id: "i" + i, name: "Soup", kcal: 400 + i * 50 }] },
    ],
  }),
);
test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/London" });

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((days) => {
    const profile = { firstName: "Jane", lastName: "Smith", email: "j@example.com" };
    Object.assign(window, {
      __authUser: { uid: "u", email: "j@example.com" },
      __docs: { "users/u": profile },
      __days: days,
    });
  }, DAYS);
  await p.goto("/app.html");
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByText("net kcal of")).toBeVisible({ timeout: 10000 });
  await p.locator("nav").getByRole("button", { name: "Compare", exact: true }).click();
  await expect(p.getByText("Compare days")).toBeVisible();
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());

test("days scroll sideways, 150 px each; the calculator is full-width underneath", async ({
  page: p,
}) => {
  await start(p);
  const grid = p.getByText("Compare days").locator("xpath=../following-sibling::div[1]");
  expect(await grid.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  expect((await box(grid)).right).toBeLessThanOrEqual(390);
  const first = await box(p.getByText(/Sun,? 4 Oct/));
  const second = await box(p.getByText(/Sat,? 3 Oct/));
  expect(Math.round(second.left - first.left)).toBe(157); // 150 + the 7 px gap
  const calc = await box(p.getByText("Reference calculator"));
  expect(calc.top).toBeGreaterThan(first.top + 150); // under the days, not beside them
  expect(calc.left).toBeLessThan(40);
});

test("nothing past the right edge outside the sideways-scrolling parts; the calculator works", async ({
  page: p,
}) => {
  await start(p);
  const out = await p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => !e.closest("nav") && !e.closest("[style*='overflow-x: auto']"))
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => e.tagName + " " + (e.textContent || "").slice(0, 30)),
  );
  expect(out).toEqual([]);
  const age = p.getByText("Age", { exact: true }).locator("..").locator("input");
  await age.fill("40");
  await expect(age).toHaveValue("40");
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
