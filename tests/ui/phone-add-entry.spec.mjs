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
test.use({ timezoneId: "Europe/London" }); // 390 x 844 comes from the phone project

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
  expect(exercise.top).toBeGreaterThan(food.top + 150); // below the food column, not beside it
  expect(exercise.left).toBeLessThan(40);
  const out = await p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => !e.closest("nav") && e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => e.tagName + " " + (e.textContent || "").slice(0, 30)),
  );
  expect(out).toEqual([]);
  await p.getByRole("button", { name: /Add Food Item [+−]$/ }).click();
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

const fold = (p, name) => p.getByRole("button", { name: new RegExp(`${name} [+−]$`) });

test("Add Food Item, Polar Sessions and Steps by hour start folded and open on tap", async ({
  page: p,
}) => {
  await start(p);
  for (const name of ["Add Food Item", "Polar Sessions", "Steps by hour"]) {
    await expect(fold(p, name)).toHaveAttribute("aria-expanded", "false");
  }
  await expect(p.getByPlaceholder("e.g. Pinto bean stew (1 portion)")).toHaveCount(0);
  await expect(p.getByRole("button", { name: /Sync/ })).toHaveCount(0);
  await fold(p, "Add Food Item").click();
  await expect(fold(p, "Add Food Item")).toHaveAttribute("aria-expanded", "true");
  await expect(p.getByPlaceholder("e.g. Pinto bean stew (1 portion)")).toBeVisible();
  await fold(p, "Polar Sessions").click();
  await fold(p, "Steps by hour").click();
  await expect(fold(p, "Steps by hour")).toHaveAttribute("aria-expanded", "true");
  await fold(p, "Add Food Item").click();
  await expect(p.getByPlaceholder("e.g. Pinto bean stew (1 portion)")).toHaveCount(0);
});

test("Day and Meal boxes line up once Add Food Item is open", async ({ page: p }) => {
  await start(p);
  await fold(p, "Add Food Item").click();
  const day = await box(p.locator("input[type=date]"));
  const meal = await box(p.locator("select").first());
  expect(day.top).toBe(meal.top);
  expect(day.height).toBe(meal.height);
  expect(day.width).toBe(meal.width);
  expect(meal.left).toBeGreaterThan(day.right); // side by side, both inside the screen
  expect(meal.right).toBeLessThanOrEqual(390);
});

test("the portion box for a chosen saved food fits a short screen without scrolling", async ({
  page: p,
}) => {
  await p.setViewportSize({ width: 390, height: 664 }); // Chrome on an iPhone, toolbars showing
  await start(p);
  await fold(p, "Add Food Item").click();
  const name = p.getByPlaceholder("e.g. Pinto bean stew (1 portion)");
  await name.fill("Soup");
  await name.press("Enter");
  await expect(p.getByText("How much?")).toBeVisible();
  const open = async () => {
    const modal = p
      .getByText("How much?")
      .locator("xpath=ancestor::div[contains(@style,'overflow')][1]");
    const b = await box(modal.locator("xpath=.."));
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.bottom).toBeLessThanOrEqual(664);
    expect(b.right).toBeLessThanOrEqual(390);
    const unit = await box(p.getByRole("combobox").last());
    expect(unit.right).toBeLessThanOrEqual(b.right); // the unit drop-down stays inside the box
    expect(await modal.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
  };
  await open();
  await p.getByRole("combobox").last().selectOption("g"); // grams: preview with all eight tiles
  await expect(p.getByText("Net C").first()).toBeVisible();
  await open();
});
