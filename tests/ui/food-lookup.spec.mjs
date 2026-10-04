// tests/ui/food-lookup.spec.mjs — "Get Nutrition" box for a food that isn't a saved recipe
// (Fix 26 PR 8): opening, amount sent to Claude, filling the form, errors, saving to Saved
// recipes (per portion, by weight, duplicates), and Add Item's automatic add.
import { test, expect } from "@playwright/test";

const APPLE = {
  kind: "INGREDIENT",
  display_name: "Apple (2 portions)",
  kcal: 104.6,
  fat: 0.4,
  sat_fat: 0,
  carbs: 28,
  sugar: 20,
  fibre: "x",
  net_carbs: 23,
  protein: 0.6,
};
const LEGACY = [
  { id: "o1", name: "Oats", servings: 1, nutrition: { kcal: 0 }, ingredients: [] },
  { id: "o2", name: " oats ", servings: 1, nutrition: {}, ingredients: [] },
  {
    id: "pb",
    name: "Porridge Bowl",
    servings: 1,
    nutrition: { kcal: 300 },
    ingredients: [{ amount: "2 portions", item: "Oats" }],
  },
];

test("Get Nutrition box", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const sent = [];
  let reply = "";
  let delay = 0;
  await p.route("**/api/claude", async (r) => {
    sent.push(JSON.parse(r.request().postData()));
    await new Promise((res) => setTimeout(res, delay));
    if (reply === "fail") return r.fulfill({ status: 500, body: "nope" });
    r.fulfill({ json: { content: [{ text: reply }] } });
  });
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  await p.evaluate((rs) => window.__setRecipes(rs), LEGACY);
  const ev = (f, a) => p.evaluate(f, a);
  const food = p.getByPlaceholder("e.g. Pinto bean stew (1 portion)");
  const qty = p.locator('input[type="number"][min="0.1"]');
  const unit = p.locator("select").filter({ has: p.locator('option[value="tbsp"]') });
  const save = p.locator('label:has-text("Save to Saved recipes") input');
  const confirm = p.locator("#qty-confirm-btn");
  const item = () => ev(() => window.__state.addItem);
  const lastPrompt = () => sent.at(-1).messages[0].content;
  const open = async (name) => {
    await p.getByText("✕ Clear").click();
    await food.fill(name);
    await food.blur();
    await expect(confirm).toBeVisible();
  };

  // Opens at 1 portion with the name; units on offer
  await open("Apple");
  await expect(p.getByText("How much? Claude will calculate the nutrition.")).toBeVisible();
  expect(await qty.inputValue()).toBe("1");
  expect(await unit.locator("option").evaluateAll((os) => os.map((o) => o.value))).toEqual([
    "portion",
    "g",
    "ml",
    "oz",
    "cup",
    "tbsp",
    "tsp",
  ]);
  expect(await save.isChecked()).toBe(false);

  // 2 portions: amount in the prompt, loading state, fences stripped, form filled (?? "")
  await qty.fill("2");
  reply = "```json\n" + JSON.stringify(APPLE) + "\n```";
  delay = 300;
  await confirm.click();
  await expect(p.getByText("Looking up nutrition…")).toBeVisible();
  await expect(confirm).toHaveText("…");
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveCount(0);
  expect(lastPrompt()).toContain('give the nutrition for 2 portions of "Apple"');
  expect(lastPrompt()).toContain('"display_name":"Apple (2 portion)"');
  expect(sent.at(-1).max_tokens).toBe(200);
  expect(await item()).toEqual({
    name: "Apple (2 portions)",
    kcal: 104.6,
    fat: 0.4,
    sat_fat: 0,
    carbs: 28,
    sugar: 20,
    fibre: "x",
    net_carbs: 23,
    protein: 0.6,
  });
  delay = 0;

  // "dish" in any case goes to the recipe builder
  await open("Lamb stew");
  reply = JSON.stringify({ kind: "dish" });
  await confirm.click();
  await expect(p.locator("textarea").first()).toHaveValue("Lamb stew");
  await p.getByRole("button", { name: "×" }).first().click();

  // Save ticked then Cancel: unticked next time
  await open("Plum");
  await save.check();
  await p.getByRole("button", { name: "Cancel" }).click();
  await open("Plum");
  expect(await save.isChecked()).toBe(false);
  await p.getByRole("button", { name: "Cancel" }).click();

  // No display name → "name (qty unit)"; missing values blank; Enter submits; g in prompt
  await open("Rice");
  await qty.fill("150");
  await unit.selectOption("g");
  reply = JSON.stringify({ kind: "ingredient", kcal: 0, fat: 0 });
  await qty.press("Enter");
  await expect(confirm).toHaveCount(0);
  expect(lastPrompt()).toContain('give the nutrition for 150 g of "Rice"');
  expect(lastPrompt()).toContain('"display_name":"Rice (150 g)"');
  expect(await item()).toMatchObject({ name: "Rice (150 g)", kcal: 0, fat: 0, protein: "" });

  // Bad reply or failed request → message; box stays open; blank quantity counts as 1
  await open("Kale");
  await qty.fill("");
  reply = "not json";
  await confirm.click();
  await expect(
    p.getByText("Could not fetch nutrition — fill in manually or try again."),
  ).toBeVisible();
  expect(lastPrompt()).toContain('give the nutrition for 1 portion of "Kale"');
  reply = "fail";
  await confirm.click();
  await expect(confirm).toHaveText("Get Nutrition");
  await expect(confirm).toBeEnabled();
  await p.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await open("Kale"); // backdrop closes too; error cleared on reopen
  await expect(p.getByText("Could not fetch nutrition", { exact: false })).toHaveCount(0);
  await p.mouse.click(5, 300);
  await expect(confirm).toHaveCount(0);

  // Save, 2 portions: stored per portion (1 dp; non-numbers → 0), no Wt/portion
  await open("Apple");
  await qty.fill("2");
  await save.check();
  reply = JSON.stringify(APPLE);
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  const apple = await ev(() => window.__saved.at(-1));
  expect(apple).toMatchObject({
    name: "Apple",
    description: "",
    source: "Get Nutrition",
    servings: 1,
    prep_time: "",
    cook_time: "",
    ingredients: [{ amount: "1 portion", item: "Apple" }],
    steps: [],
    notes: "",
    nutrition: {
      kcal: 52.3,
      fat: 0.2,
      sat_fat: 0,
      carbs: 14,
      sugar: 10,
      fibre: 0,
      net_carbs: 11.5,
      protein: 0.3,
    },
  });
  expect(apple.id).toMatch(/^[0-9a-z]{10,}$/);
  expect("portion_g" in apple).toBe(false);

  // Save by grams: the amount is one portion, Wt/portion = grams; other units: no weight
  await open("Rice");
  await qty.fill("150");
  await unit.selectOption("g");
  await save.check();
  reply = JSON.stringify({ kind: "INGREDIENT", kcal: 195 });
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  const rice = await ev(() => window.__saved.at(-1));
  expect(rice.ingredients).toEqual([{ amount: "150 g", item: "Rice" }]);
  expect([rice.portion_g, rice.nutrition.kcal]).toEqual([150, 195]);
  await open("Milk");
  await qty.fill("200");
  await unit.selectOption("ml");
  await save.check();
  reply = JSON.stringify({ kind: "INGREDIENT", kcal: 130 });
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  expect("portion_g" in (await ev(() => window.__saved.at(-1)))).toBe(false);

  // Saving a name already saved twice (without usable nutrition, so it is looked up): first copy overwritten, the other deleted,
  // list sorted, and recipes using it updated
  await open("OATS");
  await save.check();
  reply = JSON.stringify({ kind: "INGREDIENT", kcal: 150 });
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  await expect.poll(() => ev(() => window.__saved.filter((s) => s.id === "pb").length)).toBe(1);
  const oats = await ev(() => window.__saved.findLast((s) => s.name === "OATS"));
  expect(oats.id).toBe("o2"); // first same-name copy in list order (" oats " sorts first)
  expect(await ev(() => window.__deleted)).toEqual(["o1"]);
  expect(await ev(() => window.__state.userRecipes.map((r) => r.name))).toEqual([
    "Apple",
    "Milk",
    "OATS",
    "Porridge Bowl",
    "Rice",
  ]);
  expect(await ev(() => window.__saved.findLast((s) => s.id === "pb").nutrition.kcal)).toBe(600);

  // Add Item with no nutrition: look up, then the item is added to the day
  await p.getByText("✕ Clear").click();
  await p.locator('input[type="date"]').first().fill("2026-10-10"); // a day not logged yet
  await p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "Breakfast" }) })
    .first()
    .selectOption({ label: "☕ Breakfast" });
  await food.fill("Pear");
  await p.getByRole("button", { name: "Add Item" }).click();
  await expect(confirm).toBeVisible();
  reply = JSON.stringify({ kind: "INGREDIENT", display_name: "Pear (1 portion)", kcal: 57 });
  await confirm.click();
  await expect(p.getByText("✅ Item added!")).toBeVisible();
  expect(await item()).toMatchObject({ name: "", kcal: "" });

  expect(errs).toEqual([]);
});
