// tests/ui/recipe-modal.spec.mjs — the recipe card modal (Fix 26 PR 45), opened with 👁 from
// Saved Recipes: header (name, source, ×), description, the tag row (prep, cook, Wt/portion
// with "(est.)", serves), nutrition per serving, ingredients, numbered method, notes; a bare
// recipe shows only what it has; closing by ×, by the backdrop, not by the card.
import { test, expect } from "./cover.mjs";

const FULL = {
  id: "r-full",
  name: "Pinto Bean Stew",
  source: "Grandma's book, p. 12",
  description: "A hearty stew for cold evenings.",
  prep_time: "10 min",
  cook_time: "45 min",
  servings: 4,
  portion_g: 225,
  portion_g_source: "estimated",
  nutrition: { kcal: 338, fat: 7.5, carbs: 52, fibre: 12, net_carbs: 40, protein: 18 },
  ingredients: [
    { amount: "400 g", item: "pinto beans, cooked" },
    { amount: "1", item: "onion, diced" },
    { amount: "", item: "salt to taste" },
  ],
  steps: ["Soften the onion.", "Add the beans and simmer.", "Season."],
  notes: "Freezes well.",
};
const BARE = { id: "r-bare", name: "Toast", nutrition: { kcal: 80 }, ingredients: [], steps: [] };

const start = async (p, recipes) => {
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  await p.evaluate((rs) => window.__setRecipes(rs), recipes);
  await p.getByText("📖 Browse Saved Recipes").click();
  await expect(p.getByText("📖 Saved Recipes", { exact: true })).toBeVisible();
};
const open = async (p, name) => {
  await p
    .locator("div", { hasText: name })
    .filter({ has: p.locator('button[title="Edit recipe"]') })
    .last()
    .locator("button", { hasText: "👁" })
    .click();
  return modal(p);
};
const modal = (p) => p.locator("div[style*='z-index: 5000']");
const card = (p) => modal(p).locator("> div");
const style = (loc, prop) => loc.evaluate((e, k) => getComputedStyle(e)[k], prop);
const texts = (loc) => loc.allTextContents();

test("a full recipe: every section, in order", async ({ page: p }) => {
  await start(p, [FULL]);
  const m = await open(p, "Pinto Bean Stew");
  await expect(m).toBeVisible();
  expect(await style(m, "position")).toBe("fixed");
  expect(await style(m, "backgroundColor")).toBe("rgba(0, 0, 0, 0.35)");
  expect(await style(card(p), "width")).toBe("580px");
  expect(await style(card(p), "borderRadius")).toBe("10px");
  const head = card(p).locator("> div").first();
  expect(await style(head, "position")).toBe("sticky");
  await expect(head).toContainText("Pinto Bean Stew");
  await expect(head).toContainText("Grandma's book, p. 12");
  expect(await style(head.getByText("Pinto Bean Stew"), "fontSize")).toBe("14px");
  expect(await style(head.getByText("Grandma's book, p. 12"), "fontSize")).toBe("11px");
  await expect(head.getByRole("button", { name: "×" })).toBeVisible();

  const body = card(p).locator("> div").nth(1);
  await expect(body.locator("p")).toHaveText("A hearty stew for cold evenings.");
  expect(await style(body.locator("p"), "lineHeight")).toBe("19.2px"); // 1.6 × 12px
  const tags = body.locator("> div").first().locator("span");
  expect(await texts(tags)).toEqual([
    "Prep 10 min",
    "Cook 45 min",
    "Wt/portion 225 g (est.)",
    "Serves 4",
  ]);
  expect(await style(tags.first(), "borderRadius")).toBe("20px");
  expect(await style(tags.first(), "fontSize")).toBe("11px");

  const sections = body
    .locator("div")
    .filter({ hasText: /^(Nutrition per serving|Ingredients|Method)$/ });
  expect(await texts(sections)).toEqual(["Nutrition per serving", "Ingredients", "Method"]);
  expect(await style(sections.first(), "textTransform")).toBe("uppercase");
  expect(await style(sections.first(), "fontSize")).toBe("10px");
  const grid = sections.first().locator("xpath=following-sibling::div[1]");
  expect(await style(grid, "display")).toBe("grid");
  expect(await texts(grid.locator("> div"))).toEqual([
    "338kcal",
    "7.5Fat g",
    "52Carbs g",
    "12Fibre g",
    "40Net C g",
    "18Prot g",
  ]);
  expect(await style(grid.locator("> div > div").first(), "fontFamily")).toMatch(/mono/i);
  expect(await style(grid.locator("> div > div").nth(1), "textTransform")).toBe("uppercase");

  const ingredients = sections.nth(1).locator("xpath=following-sibling::div[1]").locator("> div");
  expect(await texts(ingredients)).toEqual([
    "400 gpinto beans, cooked",
    "1onion, diced",
    "salt to taste",
  ]);
  expect(await style(ingredients.first().locator("span").first(), "minWidth")).toBe("65px");
  expect(await style(ingredients.first().locator("span").first(), "color")).toBe(
    "rgb(24, 95, 165)",
  );
  expect(await style(ingredients.first(), "borderBottomStyle")).toBe("solid");

  const steps = sections.nth(2).locator("xpath=following-sibling::div[1]");
  expect(await style(steps, "marginBottom")).toBe("14px"); // room for the notes
  expect(await texts(steps.locator("> div"))).toEqual([
    "1Soften the onion.",
    "2Add the beans and simmer.",
    "3Season.",
  ]);
  const badge = steps.locator("> div").first().locator("span");
  expect(await style(badge, "borderRadius")).toBe("50%");
  expect(await style(badge, "position")).toBe("absolute");
  expect(await style(badge, "backgroundColor")).toBe("rgb(55, 138, 221)");
  expect(await style(steps.locator("> div").first(), "paddingLeft")).toBe("32px");

  const notes = body.getByText("Freezes well.");
  expect(await style(notes, "borderLeftWidth")).toBe("2px");
  expect(await style(notes, "marginTop")).toBe("14px");
});

test("a bare recipe: only name, nutrition zeros, empty lists; no tags, notes or description", async ({
  page: p,
}) => {
  await start(p, [
    BARE,
    { ...FULL, id: "r2", name: "Stew 2", portion_g: 0, portion_g_source: "estimated" },
  ]);
  const m = await open(p, "Toast");
  const body = card(p).locator("> div").nth(1);
  await expect(body.locator("p")).toHaveCount(0);
  await expect(card(p).locator("> div").first().locator("div > div")).toHaveCount(1); // no source line
  const sections = body
    .locator("div")
    .filter({ hasText: /^(Nutrition per serving|Ingredients|Method)$/ });
  expect(await texts(sections)).toEqual(["Nutrition per serving", "Ingredients", "Method"]);
  expect(await texts(body.locator("> div").first().locator("span"))).toEqual([]); // no tag row
  const grid = sections.first().locator("xpath=following-sibling::div[1]");
  expect(await texts(grid.locator("> div"))).toEqual([
    "80kcal",
    "0Fat g",
    "0Carbs g",
    "0Fibre g",
    "0Net C g",
    "0Prot g",
  ]);
  const steps = sections.nth(2).locator("xpath=following-sibling::div[1]");
  expect(await style(steps, "marginBottom")).toBe("0px");
  await expect(steps.locator("> div")).toHaveCount(0);
  await expect(body.getByText("Freezes well.")).toHaveCount(0);
  expect(await style(body.locator("> div").last(), "borderLeftWidth")).toBe("0px"); // no notes box
  await m.getByRole("button", { name: "×" }).click();
  await expect(modal(p)).toHaveCount(0);

  // no nutrition at all: no nutrition section; a zero Wt/portion is not a tag; a plain weight has no "(est.)"
  await p.evaluate(
    (rs) => window.__setRecipes(rs),
    [
      { id: "r3", name: "Water", ingredients: [{ amount: "1", item: "glass" }] },
      { id: "r4", name: "Rice", portion_g: 150, portion_g_source: "measured", servings: 2 },
      { ...FULL, id: "r2", name: "Stew 2", portion_g: 0, portion_g_source: "estimated" },
      { id: "r5", name: "Oats", portion_g: 40 },
    ],
  );
  await open(p, "Water");
  expect(
    await texts(
      card(p)
        .locator("div")
        .filter({ hasText: /^(Nutrition per serving|Ingredients|Method)$/ }),
    ),
  ).toEqual(["Ingredients", "Method"]);
  await modal(p).getByRole("button", { name: "×" }).click();
  await open(p, "Rice");
  expect(
    await texts(card(p).locator("> div").nth(1).locator("> div").first().locator("span")),
  ).toEqual(["Wt/portion 150 g", "Serves 2"]);
  await modal(p).getByRole("button", { name: "×" }).click();
  await open(p, "Oats"); // a weight alone still makes the row
  expect(
    await texts(card(p).locator("> div").nth(1).locator("> div").first().locator("span")),
  ).toEqual(["Wt/portion 40 g"]);
  await modal(p).getByRole("button", { name: "×" }).click();
  await open(p, "Stew 2");
  expect(
    await texts(card(p).locator("> div").nth(1).locator("> div").first().locator("span")),
  ).toEqual(["Prep 10 min", "Cook 45 min", "Serves 4"]);
});

test("closing: the × button and the backdrop close it; clicks on the card don't", async ({
  page: p,
}) => {
  await start(p, [FULL]);
  const m = await open(p, "Pinto Bean Stew");
  await card(p).getByText("Ingredients").click();
  await expect(m).toBeVisible();
  await m.click({ position: { x: 5, y: 5 } }); // the backdrop
  await expect(modal(p)).toHaveCount(0);
  await open(p, "Pinto Bean Stew");
  await modal(p).getByRole("button", { name: "×" }).click();
  await expect(modal(p)).toHaveCount(0);
});
