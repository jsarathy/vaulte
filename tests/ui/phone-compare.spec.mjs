// tests/ui/phone-compare.spec.mjs — the Compare tab on a phone (Fix 43.8), at 390 x 844 in the
// signed-in page: the Reference calculator is a pill at the top that opens a pop-up card (Fix 58), the five days are
// ONE card with the macro names once down the left, and nothing sticks out past the right edge.
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
test.use({ timezoneId: "Europe/London" }); // 390 x 844 comes from the phone project

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

const pill = (p) => p.getByRole("button", { name: "Reference calculator", exact: true });
const popup = (p) => p.getByRole("dialog", { name: "Reference calculator" });

test("the calculator is a pill at the top that opens as a pop-up card", async ({ page: p }) => {
  await start(p);
  await expect(p.getByText("Age", { exact: true })).toHaveCount(0);
  expect((await box(pill(p))).top).toBeLessThan((await box(p.getByText("Compare days"))).top);
  await pill(p).click();
  await expect(popup(p)).toBeVisible();
  await expect(popup(p).getByText("Age", { exact: true })).toBeVisible();
  await expect(popup(p).getByText("BMR")).toBeVisible();
  await popup(p).getByRole("button", { name: "Close" }).click();
  await expect(popup(p)).toHaveCount(0);
});

test("one card: macro names once, a column per day", async ({ page: p }) => {
  await start(p);
  await expect(p.locator("table")).toHaveCount(1);
  for (const name of ["kcal", "Fat", "Carbs", "Net C", "Fibre", "Protein", "Sugar"])
    await expect(p.getByRole("rowheader", { name, exact: true })).toHaveCount(1);
  await expect(p.locator("thead button")).toHaveCount(5);
  await expect(p.getByRole("cell", { name: "400", exact: true })).toBeVisible();
  await expect(p.getByRole("cell", { name: "600", exact: true })).toBeVisible();
  const t = await box(p.locator("table"));
  expect(t.left).toBeGreaterThanOrEqual(0);
  expect(t.right).toBeLessThanOrEqual(390);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("tapping a date head swaps the day; the calculator still works", async ({ page: p }) => {
  await start(p);
  p.once("dialog", (d) => d.accept("2026-09-30"));
  await p.locator("thead button").first().click();
  await expect(p.locator("thead button").first()).toHaveText(/Wed,? 30 Sep/);
  expect((await box(p.locator("thead button").first())).height).toBeGreaterThanOrEqual(40);
  await pill(p).click();
  const age = popup(p).getByText("Age", { exact: true }).locator("..").locator("input");
  await age.fill("40");
  await expect(age).toHaveValue("40");
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
