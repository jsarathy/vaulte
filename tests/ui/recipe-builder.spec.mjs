// tests/ui/recipe-builder.spec.mjs — recipe builder details not pinned by the Fix 18–25 specs
// (Fix 26 PR 6): dependents notice, Save disabled while recalculating, edits don't touch the
// saved copy until Save, whitespace-only changes don't need a recalculation, new ids, and
// Claude recipes without a usable portion weight.
import { test, expect } from "@playwright/test";

const A = {
  id: "ra",
  name: "Base Stew",
  servings: 2,
  portion_g: 200,
  portion_g_source: "weighed",
  nutrition: { kcal: 300, fat: 10, protein: 20 },
  ingredients: [{ amount: "400g", item: "beans" }],
};
const B = {
  id: "rb",
  name: "Stew Bowl",
  servings: 1,
  portion_g: 300,
  portion_g_source: "estimated",
  nutrition: { kcal: 400, fat: 12, protein: 22 },
  ingredients: [
    { amount: "200g", item: "Base Stew" },
    { amount: "100g", item: "rice" },
  ],
};
const LONE = {
  id: "rl",
  name: "Lone Soup",
  servings: 1,
  portion_g: 250,
  portion_g_source: "weighed",
  nutrition: { kcal: 90 },
  ingredients: [{ amount: "250g", item: "water" }],
};

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const state = { reply: null };

test("recipe builder", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  await p.evaluate((rs) => window.__setRecipes(rs), [A, LONE, B]);
  const ev = (f, a) => p.evaluate(f, a);
  const notice = p.getByText(/^Also updated/);
  const stale = p.getByText("nutrition will be recalculated", { exact: false });
  const nameBox = p.getByPlaceholder("Recipe name");
  const amount = (i) => p.getByPlaceholder("amount").nth(i);
  const save = p.getByRole("button", { name: /Save Changes|aving…/ });
  const recalc = p.getByRole("button", { name: /Recalculat/ }).first();
  const openList = async () => {
    if (!(await p.getByText("📖 Saved Recipes").count()))
      await p.getByText("📖 Browse Saved Recipes").click();
  };
  const edit = async (name) => {
    await openList();
    await p
      .locator("div", { hasText: name })
      .filter({ has: p.locator('button[title="Edit recipe"]') })
      .last()
      .locator('button[title="Edit recipe"]')
      .click();
    await expect(nameBox).toHaveValue(name);
  };

  // One dependent: singular wording; edit-mode banner
  await edit("Base Stew");
  await expect(p.getByText("✏️ Edit anything below, then save")).toBeVisible();
  await nameBox.fill("Base Stew v2");
  await save.click();
  await expect(notice).toHaveText("Also updated 1 recipe that uses it: Stew Bowl");

  // Then saving a recipe nothing uses clears the notice
  await edit("Lone Soup");
  await nameBox.fill("Lone Soup 2");
  await save.click();
  await expect(p.getByText("📖 Saved Recipes")).toBeVisible();
  await p.waitForTimeout(300);
  expect(await notice.count()).toBe(0);

  // Whitespace around an amount isn't a change; edits don't touch the saved copy until Save
  await edit("Stew Bowl");
  await amount(1).fill(" 100g ");
  await expect(stale).toHaveCount(0);
  await amount(1).fill("150g");
  await expect(stale).toHaveCount(1);
  const saved = await ev(() => window.__state.userRecipes.find((r) => r.id === "rb"));
  expect(saved.ingredients[1].amount).toBe("100g");

  // Save is disabled while Recalculate runs
  await recalc.click();
  await expect(save).toBeDisabled();
  await expect(save).toBeEnabled();
  // Recalculate error without a message → the default text
  await ev(() => (window.__failRecalc = "blank"));
  await recalc.click();
  await expect(p.getByText("Could not recalculate nutrition.")).toBeVisible();
  await ev(() => (window.__failRecalc = false));

  // While saving (with recalculation) Cancel is disabled and the backdrop is ignored
  await amount(1).fill("160g");
  await save.click();
  await expect(p.getByRole("button", { name: "⏳ Recalculating & saving…" })).toBeVisible();
  await expect(p.getByRole("button", { name: "Cancel" }).last()).toBeDisabled();
  await p.mouse.click(5, 300);
  await expect(p.getByText("📖 Saved Recipes")).toBeVisible(); // back to the list once saved
  await edit("Stew Bowl");
  await amount(1).fill("175g");
  await p.getByRole("button", { name: "Cancel" }).last().click();
  expect(
    (await ev(() => window.__state.userRecipes.find((r) => r.id === "rb"))).ingredients[1].amount,
  ).toBe("160g");

  // Describe step: Generate needs text; shows progress; default error; Start over keeps text
  await p.getByRole("button", { name: "×" }).first().click(); // close Saved Recipes
  await p.getByText("Create with Claude", { exact: false }).first().click();
  const describe = p.locator("textarea").first();
  const generate = p.getByRole("button", { name: /Generate Recipe|Generating/ });
  await describe.fill("   ");
  await expect(generate).toBeDisabled();
  await describe.fill("lentil soup");
  await ev(() => Object.assign(window, { __failCreate: true, __createDelay: 400 }));
  await generate.click();
  await expect(p.getByRole("button", { name: "⏳ Generating…" })).toBeDisabled();
  await expect(
    p.getByText("Could not parse recipe. Try adding more detail about ingredients and quantities."),
  ).toBeVisible();
  await expect(p.getByRole("button", { name: "Generate Recipe →" })).toBeEnabled();
  await ev(() => Object.assign(window, { __failCreate: false, __createDelay: 0 }));
  await generate.click();
  await expect(p.getByText("✓ Recipe found — edit anything below, then save")).toBeVisible();
  await p.getByRole("button", { name: "← Start over" }).click();
  await expect(describe).toHaveValue("lentil soup");
  await p.mouse.click(5, 300); // backdrop closes the builder
  await expect(describe).toHaveCount(0);

  // New recipes from Claude get a fresh id; no usable portion weight → none saved
  const create = async (result) => {
    await ev((r) => (window.__createResult = r), result);
    await p.getByText("Create with Claude", { exact: false }).first().click();
    await p.locator("textarea").first().fill("something");
    await p.getByText("Generate Recipe →").click();
    await p.getByText("✓ Save Recipe").click();
    await expect(p.getByText("✓ Save Recipe")).toHaveCount(0);
    return ev(() => window.__saved.at(-1));
  };
  const base = { id: "x", servings: 1, ingredients: [{ amount: "1", item: "egg" }] };
  const r1 = await create({ ...base, name: "New One", portion_g: 0, nutrition: { kcal: 70 } });
  const r2 = await create({ ...base, name: "New Two", portion_g: "abc", nutrition: { kcal: 5 } });
  expect(r1.id).not.toBe("x");
  expect(r2.id).not.toBe(r1.id);
  expect([r1.portion_g, r2.portion_g]).toEqual([null, null]);

  // A dish typed as a food opens the builder with its name
  await p.route("**/api/claude", (r) =>
    r.fulfill({ json: { content: [{ text: JSON.stringify(state.reply) }] } }),
  );
  state.reply = { kind: "DISH" };
  const food = p.getByPlaceholder("e.g. Pinto bean stew (1 portion)");
  await p.getByText("✕ Clear").click(); // the last new recipe filled the form
  await food.fill("Lamb curry");
  await food.blur();
  await p.locator("#qty-confirm-btn").click();
  await expect(p.locator("textarea").first()).toHaveValue("Lamb curry");
  await p.getByRole("button", { name: "×" }).first().click();

  // Photo items → "Save as Recipe" opens the builder filled in
  state.reply = [{ name: "Banana", kcal: 90, protein: 1 }];
  await p
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "a.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG, "base64"),
    });
  await p.getByText("📖 Save as Recipe").click();
  await expect(nameBox).toHaveValue("Banana");
  await expect(stale).toHaveCount(1); // nutrition came from the photo, not the ingredients

  expect(errs).toEqual([]);
});
