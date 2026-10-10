// tests/ui/recipe-form.spec.mjs — the recipe builder's editable form (Fix 26 PR 7): every field
// reaches the saved recipe, list rows add/edit/remove the right entry, link badges and
// highlighting, the saved-name list, the (est.) marker and the Recalculate button's states.
import { test, expect } from "./cover.mjs";

const STEW = {
  id: "fs",
  name: "Form Stew",
  servings: 2,
  portion_g: 328,
  portion_g_source: "estimated",
  nutrition: { kcal: 338, fat: 11, protein: 15 },
  ingredients: [{ amount: "600g", item: "beans" }],
  steps: ["Soak"],
};
const PUNCH = {
  id: "fp",
  name: "Form Punch",
  servings: 1,
  nutrition: { kcal: 9 },
  ingredients: [],
};
const BOWL = {
  id: "fb",
  name: "Form Bowl",
  description: "old",
  servings: 2,
  prep_time: "5",
  cook_time: "10",
  portion_g: 300,
  portion_g_source: "weighed",
  nutrition: { kcal: 500, fat: 9 },
  ingredients: [
    { amount: "1", item: "egg" },
    { amount: "2", item: "toast" },
    { amount: "3", item: "jam" },
  ],
  steps: ["One", "Two", "Three"],
  notes: "",
};

test("recipe form", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  await p.evaluate((rs) => window.__setRecipes(rs), [BOWL, PUNCH, STEW]);
  const ev = (f, a) => p.evaluate(f, a);
  const field = (ph) => p.getByPlaceholder(ph, { exact: true });
  const label = (text) => p.locator("label", { hasText: text }).locator("input");
  const macro = (name) => p.locator(`xpath=//div[div[normalize-space(.)="${name}"]]/input`);
  const steps = () => p.locator("textarea:not([placeholder])");
  const badges = p.locator("[data-link-badge]");

  await p.getByText("📖 Browse Saved Recipes").click();
  await p
    .locator("div", { hasText: "Form Bowl" })
    .filter({ has: p.locator('button[title="Edit recipe"]') })
    .last()
    .locator('button[title="Edit recipe"]')
    .click();
  await expect(field("Recipe name")).toHaveValue("Form Bowl");

  // Saved-name list for ingredients: other recipes only
  expect(
    await ev(() =>
      [...document.querySelectorAll("#vaulte-saved-recipe-names option")].map((o) => o.value),
    ),
  ).toEqual(["Form Punch", "Form Stew"]);

  // Plain fields; invalid servings → blank; Wt/portion typed (no (est.)), then estimated shown
  await field("One-line description").fill("new desc");
  await label("⏱ Prep").fill("15 minutes");
  await label("🍳 Cook").fill("40 minutes");
  await field("Optional notes").fill("serve hot");
  await label("🍽 Serves").fill("0");
  expect(await label("🍽 Serves").inputValue()).toBe("");
  await label("🍽 Serves").fill("3");
  expect(await p.getByText("(est.)").count()).toBe(0);

  // Nutrition values: typed number kept, invalid → 0
  await macro("Prot").fill("21.5");
  expect(await macro("Sugar").inputValue()).toBe("0"); // missing shows 0

  // Ingredients: edit item, remove the middle row, add a row, link badges + highlight
  await field("ingredient").nth(0).fill("egg white");
  await p.locator("button", { hasText: /^×$/ }).nth(2).click(); // header ×, row 1 ×, row 2 ×
  await expect(field("ingredient")).toHaveCount(2);
  expect(await field("ingredient").nth(1).inputValue()).toBe("jam");
  await p.getByText("+ Add ingredient").click();
  await field("amount").nth(2).fill("164g");
  await field("ingredient").nth(2).fill("form stew");
  await expect(badges).toHaveText(["📖 Saved recipe · 164 g · 0.5 portions · 169 kcal"]);
  await field("amount").nth(2).fill("8 oz"); // 226.8 g, rounded in the badge
  await expect(badges).toHaveText(["📖 Saved recipe · 227 g · 0.69 portions · 234 kcal"]);
  await field("amount").nth(2).fill(" 164g "); // kept as typed
  expect(
    await field("ingredient")
      .nth(2)
      .evaluate((e) => e.style.border),
  ).toBe("1px solid rgb(55, 138, 221)");
  expect(
    await field("ingredient")
      .nth(0)
      .evaluate((e) => e.style.border),
  ).toContain("0.5px");
  await p.getByText("+ Add ingredient").click();
  await field("amount").nth(3).fill("1");
  await field("ingredient").nth(3).fill("Form Punch");
  await expect(badges.nth(1)).toHaveText("📖 Saved recipe · 1 portion · 9 kcal");
  await field("amount").nth(3).fill("200g");
  await expect(badges.nth(1)).toHaveText(
    "📖 Saved recipe — Form Punch has no Wt/portion yet — use portions; Claude will estimate it instead",
  );
  expect(await badges.nth(1).evaluate((e) => e.style.color)).toBe("rgb(141, 110, 0)");
  expect(await badges.nth(0).evaluate((e) => e.style.color)).toBe("rgb(24, 95, 165)");
  await field("ingredient").nth(3).fill("Form Bowl"); // itself: never linked
  await expect(badges).toHaveCount(1);
  await p.locator("button", { hasText: /^×$/ }).nth(4).click(); // remove that row

  // Method: numbering, edit, remove the second, add one
  await expect(p.getByText("3.", { exact: true })).toBeVisible();
  await steps().nth(0).fill("One!");
  await p.locator("button", { hasText: /^×$/ }).nth(5).click(); // second step's ×
  await expect(steps()).toHaveCount(2);
  await p.getByText("+ Add step").click();
  await steps().nth(2).fill("Four");
  await expect(p.getByText("3.", { exact: true })).toBeVisible();

  // Recalculate: label and disabled while running
  const recalc = p.getByRole("button", { name: /Recalculat/ }).first();
  await recalc.click();
  await expect(p.getByRole("button", { name: "⏳ Recalculating…" })).toBeDisabled();
  await expect(
    p.getByRole("button", { name: "↻ Recalculate nutrition from ingredients above" }),
  ).toBeEnabled();
  await macro("Prot").fill("21.5"); // after recalculation
  await macro("Sat F").fill(""); // blank → 0

  // Save: everything reaches the saved recipe
  await p.getByText("✓ Save Changes").click();
  await expect(p.getByText("📖 Saved Recipes")).toBeVisible();
  const saved = await ev(() => window.__saved.at(-1));
  expect(saved.description).toBe("new desc");
  expect([saved.prep_time, saved.cook_time, saved.notes]).toEqual([
    "15 minutes",
    "40 minutes",
    "serve hot",
  ]);
  expect(saved.servings).toBe(3);
  expect([saved.portion_g, saved.portion_g_source]).toEqual([300, "weighed"]);
  expect(saved.nutrition.protein).toBe(21.5);
  expect(saved.nutrition.sat_fat).toBe(0);
  expect(saved.ingredients).toEqual([
    { amount: "1", item: "egg white" },
    { amount: "3", item: "jam" },
    { amount: " 164g ", item: "form stew" },
  ]);
  expect(saved.steps).toEqual(["One!", "Three", "Four"]);

  // Estimated weight shows (est.); typing a weight makes it the user's; clearing → null
  await p
    .locator("div", { hasText: "Form Stew" })
    .filter({ has: p.locator('button[title="Edit recipe"]') })
    .last()
    .locator('button[title="Edit recipe"]')
    .click();
  await expect(p.getByText("(est.)")).toBeVisible();
  await label("⚖ Wt/portion").fill("0");
  expect(await label("⚖ Wt/portion").inputValue()).toBe("");
  await expect(p.getByText("(est.)")).toHaveCount(0);
  await p.getByText("✓ Save Changes").click();
  await expect(p.getByText("📖 Saved Recipes")).toBeVisible();
  const stew = await ev(() => window.__saved.findLast((r) => r.id === "fs"));
  expect([stew.portion_g, stew.portion_g_source]).toEqual([null, null]);

  expect(errs).toEqual([]);
});
