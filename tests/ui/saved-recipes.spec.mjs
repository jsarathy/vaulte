// tests/ui/saved-recipes.spec.mjs — the Saved Recipes list (Fix 26 PR 9): row details, singular
// delete wording, notices (replaced, cleared by × but not by the backdrop), empty list.
import { test, expect } from "./cover.mjs";

const BASE = {
  id: "sb",
  name: "Base",
  description: "the base",
  servings: 1,
  portion_g: 200,
  portion_g_source: "weighed",
  nutrition: { kcal: 250 },
  ingredients: [],
};
const USER = {
  id: "su",
  name: "User",
  servings: 1,
  portion_g: 150,
  portion_g_source: "weighed",
  nutrition: { kcal: 300 },
  ingredients: [{ amount: "1 portion", item: "Base" }],
};
const GAMMA = {
  id: "sg",
  name: "Gamma",
  servings: 1,
  portion_g: 100,
  portion_g_source: "weighed",
  nutrition: { kcal: 100 },
  ingredients: [],
};
const DELTA = {
  id: "sd",
  name: "Delta",
  servings: 1,
  nutrition: { kcal: 50 },
  ingredients: [{ amount: "50g", item: "Gamma" }],
};
const PLAIN = { id: "sp", name: "Plain", servings: 1, nutrition: { kcal: 80 }, ingredients: [] };

test("Saved Recipes list", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const dialogs = [];
  p.on("dialog", (d) => (dialogs.push(d.message()), d.accept()));
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  await p.evaluate((rs) => window.__setRecipes(rs), [BASE, PLAIN, USER, GAMMA, DELTA]);
  const ev = (f, a) => p.evaluate(f, a);
  const notice = p.locator("[data-recipe-notice]");
  const row = (name) =>
    p
      .locator("div", { hasText: name })
      .filter({ has: p.locator('button[title="Edit recipe"]') })
      .last();
  const open = () => p.getByText("📖 Browse Saved Recipes").click();
  const closeX = () => p.getByRole("button", { name: "×" }).first().click();

  // Rows: name, description, kcal, weight, none when unknown
  await open();
  await expect(row("Base")).toContainText("the base");
  await expect(row("Base")).toContainText("250 kcal");
  await expect(row("Base").getByText("200 g", { exact: true })).toBeVisible();
  await expect(row("User").getByText("150 g", { exact: true })).toBeVisible();
  await expect(row("Plain")).toContainText("80 kcal");
  expect(await row("Plain").textContent()).not.toContain(" g");

  // A failed update of dependent recipes: amber notice
  await row("Gamma").locator('button[title="Edit recipe"]').click();
  await p.locator('label:has-text("Wt/portion") input').fill("");
  await ev(() => (window.__failRecalc = true));
  await p.getByText("✓ Save Changes").click();
  await expect(notice).toContainText("Saved, but couldn't update recipes that use it");
  await expect(notice).toHaveCSS("background-color", "rgb(255, 248, 225)");
  await expect(notice).toHaveCSS("color", "rgb(141, 110, 0)");
  await ev(() => (window.__failRecalc = false));

  // One dependent: singular wording in the confirm and the notice
  await row("Base").locator("button", { hasText: "✕" }).click();
  expect(dialogs.at(-1)).toBe(
    'Delete "Base"?\n\nThis also deletes 1 recipe that uses it:\n• User\n\nFood already logged isn\'t affected.',
  );
  await expect(notice).toHaveText("Deleted Base and 1 recipe that used it: User");
  expect(await ev(() => window.__deleted)).toEqual(["sb", "su"]);
  await expect(notice).toHaveCSS("color", "rgb(46, 125, 50)");
  await expect(notice).toHaveCSS("background-color", "rgb(232, 245, 233)");

  // Backdrop keeps the notice; × clears it
  await p.mouse.click(5, 300);
  await open();
  await expect(notice).toBeVisible();
  await closeX();
  await open();
  await expect(notice).toHaveCount(0);

  // Deleting with no dependents clears an earlier notice
  await ev(() => window.__setRecipes((rs) => [...rs, { id: "x1", name: "Zeta", nutrition: {} }]));
  await ev(() =>
    window.__setRecipes((rs) => [
      ...rs,
      {
        id: "x2",
        name: "Bowl",
        nutrition: {},
        ingredients: [{ amount: "1", item: "Zeta" }],
      },
    ]),
  );
  await row("Zeta").locator("button", { hasText: "✕" }).click();
  await expect(notice).toBeVisible();
  await row("Plain").locator("button", { hasText: "✕" }).click();
  expect(dialogs.at(-1)).toBe('Delete "Plain"?');
  await expect(notice).toHaveCount(0);

  // Empty list
  await ev(() => window.__setRecipes([]));
  await expect(
    p.getByText('No saved recipes yet. Use "Create with Claude" to build your first recipe.'),
  ).toBeVisible();

  expect(errs).toEqual([]);
});

test("Saved Recipes: search narrows the list by name, description or ingredient", async ({
  page: p,
}) => {
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  const nutrition = { kcal: 100 };
  await p.evaluate(
    (rs) => window.__setRecipes(rs),
    [
      {
        id: "a",
        name: "Pinto Bean Stew",
        description: "Slow cooked",
        nutrition,
        ingredients: [{ amount: "200g", item: "pinto beans" }],
      },
      {
        id: "b",
        name: "Tomato Soup",
        description: "Smooth starter",
        nutrition,
        form: "liquid",
        portion_g: 300,
        portion_ml: 250,
        ingredients: [{ amount: "4", item: "Tomatoes" }],
      },
      { id: "c", name: "Rice Bowl", description: "", nutrition, ingredients: [] },
    ],
  );
  await p.getByText("📖 Browse Saved Recipes").click();
  const search = p.getByRole("searchbox", { name: "Search recipes" });
  const rows = p.locator('button[title="Edit recipe"]');
  await expect(rows).toHaveCount(3);
  await expect(p.getByText("300 g · 250 ml")).toBeVisible(); // the liquid shows its volume
  await search.fill("SOUP");
  await expect(rows).toHaveCount(1);
  await expect(p.getByText("Tomato Soup", { exact: true })).toBeVisible();
  await search.fill("beans"); // an ingredient
  await expect(rows).toHaveCount(1);
  await expect(p.getByText("Pinto Bean Stew", { exact: true })).toBeVisible();
  await search.fill("bean soup"); // every word must match
  await expect(rows).toHaveCount(0);
  await expect(p.getByText("No recipes match.")).toBeVisible();
  await search.fill("");
  await expect(rows).toHaveCount(3);
  await search.fill("rice");
  await p.getByText("Rice Bowl", { exact: true }).click(); // a found recipe can still be picked
  await expect(p.getByText("Per serving (base)")).toBeVisible(); // its portion box opened
});
