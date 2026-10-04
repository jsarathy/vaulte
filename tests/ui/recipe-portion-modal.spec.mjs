// tests/ui/recipe-portion-modal.spec.mjs — the "How much?" box for adding a saved recipe (Fix 26 PR 5)
// Pins the box's behaviour before it moves out of AddEntry: labels, live scaling, Claude
// fallback states, reset on open, closing, and what is loaded into the form.
import { test, expect } from "@playwright/test";

const DAL = {
  id: "p1",
  name: "Test Dal",
  servings: 4,
  portion_g: 300,
  portion_g_source: "estimated",
  nutrition: {
    kcal: 333,
    fat: 10.04,
    sat_fat: 2,
    carbs: 40,
    sugar: 3,
    fibre: 8,
    net_carbs: 32,
    protein: 20,
  },
  ingredients: [{ amount: "500g", item: "lentils" }],
};
const SOUP = { id: "q1", name: "Test Soup", nutrition: { kcal: 100, protein: 5 }, ingredients: [] };

test("recipe portion box", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  await p.evaluate((rs) => window.__setRecipes(rs), [DAL, SOUP]);
  const body = () => p.locator("body").textContent();
  const state = () => p.evaluate(() => window.__state.addItem);
  const qty = p.locator('input[type="number"][min="0.1"]');
  const unit = p
    .locator("select")
    .filter({ has: p.locator('option[value="ml"]') })
    .last();
  const calc = p.getByRole("button", { name: "Calculate" });
  const load = p.getByText("✓ Load into Form");
  const listOpen = () => p.getByText("📖 Saved Recipes").count();
  const openFromList = async (name) => {
    if (!(await listOpen())) await p.getByText("📖 Browse Saved Recipes").click();
    await p.getByText(name, { exact: true }).last().click();
  };

  // Header, base line and base grid
  await openFromList("Test Dal");
  await expect(p.getByText("Recipe makes 4 servings")).toBeVisible();
  await expect(p.getByText("Per serving (base) · 300 g (est.)")).toBeVisible();
  expect(await body()).toContain("10.04");

  // Portions scale live (1 dp); empty or zero quantity counts as 1
  await expect(p.getByText("✓ 1 portion of Test Dal")).toBeVisible();
  expect(await calc.count()).toBe(0);
  await qty.fill("2.5");
  await expect(p.getByText("✓ 2.5 portions of Test Dal")).toBeVisible();
  expect(await body()).toContain("832.5");
  await qty.fill("");
  await expect(p.getByText("✓ 1 portion of Test Dal")).toBeVisible();
  await qty.fill("0");
  await expect(p.getByText("✓ 1 portion of Test Dal")).toBeVisible();

  // Grams with a Wt/portion: local
  await unit.selectOption("g");
  await qty.fill("150");
  await expect(p.getByText("✓ 150 g of Test Dal")).toBeVisible();
  expect(await body()).toContain("166.5");

  // Load: name gets the quantity, values rounded, box and list close
  await unit.selectOption("portion");
  await qty.fill("2");
  await expect(p.getByText("✓ 2 portions of Test Dal")).toBeVisible();
  await load.click();
  await expect(load).toHaveCount(0);
  expect(await listOpen()).toBe(0);
  const item = await state();
  expect(item.name).toBe("Test Dal (2 portions)");
  expect([item.kcal, item.fat, item.sat_fat, item.protein]).toEqual([666, 20.1, 4, 40]);

  // Reopen: back to 1 portion
  await openFromList("Test Dal");
  expect(await qty.inputValue()).toBe("1");
  expect(await unit.inputValue()).toBe("portion");
  await p.getByRole("button", { name: "×" }).last().click(); // header ×
  await expect(qty).toHaveCount(0);

  // No servings, no weight: header hint, base dashes, Claude for grams
  await openFromList("Test Soup");
  await expect(p.getByText("Adjust quantity before adding")).toBeVisible();
  const baseBox = p.getByText("Per serving (base)", { exact: true }).locator("..");
  await expect(baseBox).toBeVisible();
  expect(await baseBox.textContent()).toBe("Per serving (base)100Kcal5Prot—Carbs—Fat");
  await unit.selectOption("g");
  await qty.fill("200");
  await expect(p.getByText("so Claude will estimate the portion weight")).toBeVisible();
  await expect(p.getByText(/✓ .* of Test Soup/)).toHaveCount(0);
  expect(await load.count()).toBe(0);
  await p.evaluate(() => (window.__failScale = true));
  await calc.click();
  await expect(p.getByText("Calculating nutrition…")).toBeVisible();
  await expect(p.getByRole("button", { name: "…" })).toBeDisabled();
  await expect(
    p.getByText("Could not calculate (Mock scale failure)", { exact: false }),
  ).toBeVisible();
  await unit.selectOption("oz"); // changing unit clears the error
  await expect(p.getByText("Could not calculate", { exact: false })).toHaveCount(0);
  await unit.selectOption("g");
  await p.evaluate(() => (window.__failScale = false));
  await calc.click();
  await expect(p.getByText("✓ 200 g of Test Soup")).toBeVisible();
  expect(await body()).toContain("123.5");
  expect(await calc.count()).toBe(0);
  await qty.fill("250"); // new quantity clears Claude's result
  await expect(calc).toBeVisible();
  await expect(p.getByText(/✓ .* of Test Soup/)).toHaveCount(0);
  await qty.fill(""); // blank → Claude is asked for 1
  await calc.click();
  await expect(load).toBeVisible();
  expect(await p.evaluate(() => window.__scale.at(-1).qty)).toBe(1);
  await qty.fill("200");
  await calc.click();
  await load.click();
  expect((await state()).name).toBe("Test Soup (200g)");
  expect((await state()).kcal).toBe(123.5);

  // ml always goes to Claude, even with a Wt/portion
  await openFromList("Test Dal");
  await unit.selectOption("ml");
  await expect(
    p.getByText("Millilitres are worked out by Claude.", { exact: false }),
  ).toBeVisible();
  await expect(calc).toBeVisible();

  // Cancel and backdrop close the box
  await p.getByRole("button", { name: "Cancel" }).last().click();
  await expect(qty).toHaveCount(0);
  await openFromList("Test Dal");
  await p.mouse.click(5, 300); // backdrop (left of the box)
  await expect(qty).toHaveCount(0);

  // From the food-name dropdown: opens at 1 portion, the name box doesn't trigger a lookup
  await p.keyboard.press("Escape");
  if (await listOpen()) await p.getByRole("button", { name: "×" }).first().click();
  const nameBox = p.getByPlaceholder("e.g. Pinto bean stew (1 portion)");
  await nameBox.fill("Test D");
  await p.getByText("tap to set portions").first().dispatchEvent("mousedown");
  await expect(p.getByText("✓ 1 portion of Test Dal")).toBeVisible();
  await p.waitForTimeout(400); // the name box's blur timer has fired
  await expect(p.getByText("✓ 1 portion of Test Dal")).toBeVisible();
  await load.click();
  expect((await state()).name).toBe("Test Dal (1 portion)");

  expect(errs.filter((e) => !e.includes("Mock scale failure"))).toEqual([]);
});
