// tests/ui/phone-add-entry.spec.mjs — the Add entry tab on a phone (Fix 43.6), at 390 x 844 in the
// signed-in page (the phone CSS lives there):
// the two columns stacked, nothing past the right edge, inputs at 16 px (no zoom when typing on
// an iPhone), the boxes inside the window, thumb-sized recipe buttons, and the recipe grids
// narrowed in the recipe view (3 columns; the editor's 4 is not covered).
import { test, expect } from "@playwright/test";

const SOUP = {
  id: "r1",
  name: "Soup",
  servings: 2,
  portion_g: 300,
  nutrition: { kcal: 100, fat: 3, carbs: 12, protein: 5, sat_fat: 1, sugar: 2, fibre: 3 },
  ingredients: [{ amount: "300g", item: "water" }],
  steps: ["Boil"],
};
test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/London" });

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((r) => {
    const day = {
      date: "2026-10-04",
      notes: "",
      meals: [{ id: "mB", name: "Breakfast", items: [] }],
    };
    const profile = { firstName: "Jane", lastName: "Smith", email: "j@example.com" };
    Object.assign(window, {
      ...{ __days: [day], __recipes: [r], __noBackfill: true },
      ...{ __authUser: { uid: "u", email: "j@example.com" }, __docs: { "users/u": profile } },
    });
  }, SOUP);
  await p.goto("/app.html");
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByText("net kcal of")).toBeVisible({ timeout: 10000 });
  await p.locator("nav").getByRole("button", { name: "Add entry", exact: true }).click();
  await expect(p.getByText("🥗 Add Food Entry")).toBeVisible();
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const cols = (loc) =>
  loc.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
const inside = async (loc) => {
  const b = await box(loc);
  expect([b.left, b.top]).toEqual([expect.any(Number), expect.any(Number)]);
  expect(b.left).toBeGreaterThanOrEqual(0);
  expect(b.right).toBeLessThanOrEqual(390);
  expect(b.bottom).toBeLessThanOrEqual(844);
};

test("columns stack; nothing past the right edge; inputs are 16 px", async ({ page: p }) => {
  await start(p);
  const food = await box(p.getByText("🥗 Add Food Entry"));
  const exercise = await box(p.getByText("🏋️ Exercise", { exact: true }));
  expect(exercise.top).toBeGreaterThan(food.top + 300); // below the food column, not beside it
  expect(exercise.left).toBeLessThan(40);
  const out = await p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => !e.closest("nav") && e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => e.tagName + " " + (e.textContent || "").slice(0, 30)),
  );
  expect(out).toEqual([]);
  const name = p.getByPlaceholder("e.g. Pinto bean stew (1 portion)");
  expect(await name.evaluate((e) => getComputedStyle(e).fontSize)).toBe("16px");
});

test("Log Manual Exercise and Saved Recipes boxes fit the window", async ({ page: p }) => {
  await start(p);
  await p.getByText("🏋️ Log Manual Exercise").click();
  await expect(p.getByText("Log Exercise")).toBeVisible();
  await inside(p.getByPlaceholder(/Search exercise/).locator("../.."));
  await p.getByText("Log Exercise").locator("..").getByText("×").click();
  await p.getByText("📖 Browse Saved Recipes").click();
  await expect(p.getByText("Soup", { exact: true })).toBeVisible();
  for (const label of ["✏️", "👁", "✕"]) {
    const b = await box(p.getByRole("button", { name: label, exact: true }));
    expect(b.width).toBeGreaterThanOrEqual(40);
    expect(b.height).toBeGreaterThanOrEqual(40);
  }
});

test("recipe view: nutrition in 3 columns, inside the window", async ({ page: p }) => {
  await start(p);
  await p.getByText("📖 Browse Saved Recipes").click();
  await p.getByRole("button", { name: "👁" }).click();
  const cell = p.getByText("Nutrition per serving").locator("xpath=following-sibling::div[1]");
  expect(await cols(cell)).toBe(3);
  await inside(p.getByText("Wt/portion 300 g").locator("../.."));
});
