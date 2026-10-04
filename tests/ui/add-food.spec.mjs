// tests/ui/add-food.spec.mjs — the "Add Food Item" form on Add Entry (Fix 26 PR 13): day and
// meal, name autocomplete from saved recipes, macros (net carbs derived), Clear and Add Item.
import { test, expect } from "@playwright/test";

const STEW = {
  id: "s1",
  name: "Pinto Bean Stew",
  servings: 2,
  nutrition: { kcal: 338, protein: 15, fat: 9, carbs: 45 },
  ingredients: [],
};
const SALAD = {
  id: "s2",
  name: "Bean Salad",
  nutrition: { kcal: 0, protein: "0" },
  ingredients: [],
};
const BREAD = { id: "s3", name: "Plain Bread", nutrition: { carbs: 20 }, ingredients: [] };
const CURRY = {
  id: "s4",
  name: "Thai Chicken Curry",
  nutrition: { kcal: 500, protein: 30, fat: 20, carbs: 40 },
  ingredients: [],
};
const POT = { id: "s5", name: "Mystery Pot", ingredients: [] };
const PEAR = { kind: "INGREDIENT", display_name: "Pear (1 portion)", kcal: 57, carbs: 15 };

test("add food form", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const sent = [];
  await p.route("**/api/claude", async (r) => {
    sent.push(r.request().postData());
    r.fulfill({ json: { content: [{ text: JSON.stringify(PEAR) }] } });
  });
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  const ev = (f, a) => p.evaluate(f, a);
  await ev((rs) => window.__setRecipes(rs), [STEW, SALAD, BREAD, CURRY, POT]);
  const item = () => ev(() => window.__state.addItem);
  const food = p.getByPlaceholder("e.g. Pinto bean stew (1 portion)");
  const date = p.locator('input[type="date"]').first();
  const meal = p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select —" }) })
    .first();
  const macro = (label) =>
    p.locator(`xpath=//div[div[normalize-space(.)="${label}"]]/input`).first();
  const rows = p.getByText("tap to set portions", { exact: false });
  const list = p.locator('div[style*="max-height: 180px"]');
  const portionOpen = p.getByText("✓ Load into Form");
  const lookupOpen = p.locator("#qty-confirm-btn");
  const cancel = async () => {
    await p.waitForTimeout(200); // after the name field's delayed blur check
    await p.getByRole("button", { name: "Cancel" }).click();
  };
  const confirm = async () => {
    await p.waitForTimeout(200);
    await lookupOpen.click();
  };
  const add = () => p.getByRole("button", { name: "Add Item" }).click();
  const clear = () => p.getByText("✕ Clear").click();
  const msg = (text) => p.getByText(text, { exact: true });

  // Meal options: default slots for a day not loaded; the loaded day's own meals otherwise
  const options = () =>
    meal.locator("option").evaluateAll((os) => os.map((o) => [o.value, o.text]));
  expect((await options()).slice(0, 2)).toEqual([
    ["", "— select —"],
    ["__slot__☕ Breakfast", "☕ Breakfast"],
  ]);
  expect((await options()).length).toBeGreaterThan(3);
  await ev(() => {
    window.__allDays = [
      {
        date: "2026-10-05",
        notes: "",
        meals: [
          { id: "d1", name: "Dinner out", items: [{ id: "x", name: "Old" }] },
          { name: "No id" },
        ],
      },
    ];
  });
  await date.fill("2026-10-05");
  expect(await date.inputValue()).toBe("2026-10-05");
  expect(await options()).toEqual([
    ["", "— select —"],
    ["d1", "Dinner out"],
    ["__slot__No id", "No id"],
  ]);

  // Autocomplete: from 2 characters, any case/spacing, by part of the name
  await food.fill("b");
  await expect(rows).toHaveCount(0);
  await food.fill("BEAN");
  await expect(rows).toHaveCount(2);
  await expect(p.getByText("338 kcal · P:15g F:9g C:45g · tap to set portions")).toBeVisible();
  await food.fill("thai  chicken");
  await expect(rows).toHaveCount(1); // spaces collapsed
  await food.fill("thai chicken");
  await expect(rows).toHaveCount(1);
  expect((await item()).name).toBe("thai chicken");
  await food.fill("zz");
  await expect(rows).toHaveCount(0);
  await expect(list).toHaveCount(0); // no empty list either
  await food.fill("bean");
  await expect(rows).toHaveCount(2);
  await food.fill("b"); // back under 2 characters: list closes
  await expect(rows).toHaveCount(0);
  await food.fill("bean");
  await expect(rows).toHaveCount(2);
  await p.locator("body").click({ position: { x: 5, y: 5 } }); // blur: no exact match → Get Nutrition
  await expect(rows).toHaveCount(0);
  await expect(lookupOpen).toBeVisible();
  await cancel();
  await food.focus(); // focus shows the last matches again
  await expect(rows).toHaveCount(2);

  // Picking a row opens its portion box; the list closes; blur doesn't open Get Nutrition
  await p.getByText("Pinto Bean Stew", { exact: true }).click();
  await expect(portionOpen).toBeVisible();
  await expect(p.getByText("✓ 1 portion of Pinto Bean Stew")).toBeVisible();
  await expect(rows).toHaveCount(0);
  await p.waitForTimeout(300);
  await expect(lookupOpen).toHaveCount(0);
  await cancel();

  // Blur: exact saved name (any case/spacing) → its portion box
  const blurWith = async (name) => {
    await clear();
    await food.fill(name);
    await food.blur();
  };
  await blurWith("  pinto   BEAN stew ");
  await expect(p.getByText("✓ 1 portion of Pinto Bean Stew")).toBeVisible();
  await cancel();
  await blurWith("plain bread"); // carbs alone are enough
  await expect(p.getByText("✓ 1 portion of Plain Bread")).toBeVisible();
  await cancel();
  // a saved recipe without macros, or with no nutrition at all, is looked up instead
  for (const name of ["Bean Salad", "Mystery Pot"]) {
    await blurWith(name);
    await expect(lookupOpen).toBeVisible();
    await expect(portionOpen).toHaveCount(0);
    await cancel();
  }
  // blank, or already has nutrition: nothing opens
  await blurWith("   ");
  await food.focus();
  await macro("kcal").fill("5");
  await p.waitForTimeout(300);
  await expect(lookupOpen).toHaveCount(0);
  await food.fill("Pinto Bean Stew");
  await food.blur();
  await p.waitForTimeout(300);
  await expect(portionOpen).toHaveCount(0);
  await expect(lookupOpen).toHaveCount(0);
  for (const k of ["fat", "carbs", "protein"]) {
    await clear();
    await macro({ fat: "Fat (g)", carbs: "Carbs (g)", protein: "Protein (g)" }[k]).fill("1");
    await food.fill("Pinto Bean Stew");
    await food.blur();
    await p.waitForTimeout(300);
    await expect(portionOpen).toHaveCount(0);
  }

  // Enter: exact saved name → portion box at once; otherwise nothing until blur
  await clear();
  await food.fill("pinto bean stew");
  await expect(rows).toHaveCount(1);
  await food.press("Enter");
  await expect(portionOpen).toBeVisible();
  await expect(rows).toHaveCount(0); // list closed
  await food.fill(""); // so leaving the field doesn't reopen it
  await cancel();
  await food.fill("Pear");
  await food.press("Enter");
  await p.waitForTimeout(300);
  await expect(lookupOpen).toHaveCount(0);
  await food.fill("");
  await food.press("Enter"); // blank: nothing
  await p.waitForTimeout(300);
  await expect(portionOpen).toHaveCount(0);

  // Macros: each field kept as typed; net carbs = carbs − fibre (≥ 0, 1 dp)
  await clear();
  const labels = [
    ["kcal", "kcal"],
    ["fat", "Fat (g)"],
    ["sat_fat", "Sat Fat (g)"],
    ["sugar", "Sugar (g)"],
    ["protein", "Protein (g)"],
  ];
  for (const [i, [, label]] of labels.entries()) await macro(label).fill(String(i + 1.5));
  await macro("Carbs (g)").fill("12.34");
  expect((await item()).net_carbs).toBe("12.3");
  await macro("Fibre (g)").fill("2");
  expect(await item()).toEqual({
    name: "",
    kcal: "1.5",
    fat: "2.5",
    sat_fat: "3.5",
    carbs: "12.34",
    sugar: "4.5",
    fibre: "2",
    net_carbs: "10.3",
    protein: "5.5",
  });
  await expect(macro("Net Carbs (g)")).toHaveValue("10.3");
  await macro("Carbs (g)").fill("10");
  expect((await item()).net_carbs).toBe("8.0");
  await macro("Fibre (g)").fill("20");
  expect((await item()).net_carbs).toBe("0.0");
  await macro("Carbs (g)").fill("");
  expect((await item()).net_carbs).toBe("0.0");
  await macro("Fibre (g)").fill("");
  await macro("Carbs (g)").fill("7");
  expect((await item()).net_carbs).toBe("7.0");
  await macro("Net Carbs (g)").fill("4");
  await macro("Sugar (g)").fill("1");
  expect((await item()).net_carbs).toBe("4");
  expect(await macro("Net Carbs (g)").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    "rgb(240, 244, 248)",
  );
  expect(await macro("Fat (g)").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    "rgb(255, 255, 255)",
  );

  // Clear empties every field
  await clear();
  expect(await item()).toEqual({
    name: "",
    kcal: "",
    fat: "",
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });

  // Add Item: needs a name
  await add();
  await expect(msg("Please enter a food name")).toBeVisible();
  expect(
    await msg("Please enter a food name").evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(255, 235, 238)");
  // no nutrition: a saved recipe opens its portion box; anything else is looked up and added
  await food.fill("Pinto Bean Stew");
  await add();
  await expect(p.getByText("✓ 1 portion of Pinto Bean Stew")).toBeVisible();
  await cancel();
  await meal.selectOption("d1");
  await clear();
  await food.fill("Pear");
  await add();
  await expect(lookupOpen).toBeVisible();
  await confirm();
  await expect(msg("✅ Item added!")).toBeVisible();
  let saved = await ev(() => window.__persisted.at(-1));
  expect(saved.meals[0].items.map((i) => i.name)).toEqual(["Old", "Pear (1 portion)"]);
  // blur's lookup only fills the form
  const count = await ev(() => window.__persisted.length);
  await food.fill("Plum");
  await food.blur();
  await confirm();
  await expect(lookupOpen).toHaveCount(0);
  expect((await item()).kcal).toBe(57);
  expect(await ev(() => window.__persisted.length)).toBe(count);

  // With nutrition: needs a meal
  const fillToast = async () => {
    await clear();
    await macro("kcal").fill("80.5");
    await macro("Carbs (g)").fill("15");
    await food.fill("Toast");
  };
  await meal.selectOption("");
  await fillToast();
  await add();
  await expect(msg("Please select or create a meal")).toBeVisible();

  // Into the loaded day's meal, after its items; numbers parsed, blanks 0; form cleared
  await ev(() => (window.__currentDay = null));
  await meal.selectOption("d1");
  await fillToast();
  await macro("Protein (g)").fill("3");
  await add();
  await expect(msg("✅ Item added!")).toBeVisible();
  expect(
    await msg("✅ Item added!").evaluate((e) => [
      getComputedStyle(e).backgroundColor,
      getComputedStyle(e).color,
    ]),
  ).toEqual(["rgb(232, 245, 233)", "rgb(46, 125, 50)"]);
  saved = await ev(() => window.__persisted.at(-1));
  expect(saved.date).toBe("2026-10-05");
  expect(saved.meals[1]).toEqual({ name: "No id" });
  const toast = saved.meals[0].items.at(-1);
  expect(toast).toEqual({
    id: toast.id,
    name: "Toast",
    kcal: 80.5,
    fat: 0,
    sat_fat: 0,
    carbs: 15,
    sugar: 0,
    fibre: 0,
    net_carbs: 15,
    protein: 3,
  });
  expect(toast.id).toBeTruthy();
  expect(toast.id).not.toBe(saved.meals[0].items.at(-2).id);
  expect((await item()).name).toBe("");
  expect(await ev(() => window.__currentDay)).toBe(null); // not today
  // any one of fat, carbs or protein counts as nutrition: added without a lookup
  for (const label of ["Fat (g)", "Carbs (g)", "Protein (g)"]) {
    const before = await ev(() => window.__persisted.length);
    await clear();
    await macro(label).fill("2");
    await food.fill("Bit");
    await add();
    await expect.poll(() => ev(() => window.__persisted.length)).toBe(before + 1);
    expect((await ev(() => window.__persisted.at(-1))).meals[0].items.at(-1).name).toBe("Bit");
  }
  await expect(lookupOpen).toHaveCount(0);
  await expect(msg("✅ Item added!")).toHaveCount(0, { timeout: 4000 });

  // Today: the day view is updated too; a slot resolves to that day's meal by name
  await ev(() => {
    window.__allDays = [
      { date: "2026-10-03", notes: "", meals: [{ id: "t1", name: "☕ Breakfast", items: [] }] },
    ];
  });
  await date.fill("2026-10-02");
  await date.fill("2026-10-03");
  await meal.selectOption("t1");
  await fillToast();
  await add();
  await expect(msg("✅ Item added!")).toBeVisible();
  expect((await ev(() => window.__currentDay)).meals[0].items[0].name).toBe("Toast");

  // A day not loaded: loaded from Firestore, else default slots; slot resolved by name
  await ev(() => (window.__allDays = []));
  await date.fill("2026-10-09");
  await meal.selectOption({ label: "🌙 Dinner" });
  await fillToast();
  await add();
  await expect(msg("✅ Item added!")).toBeVisible();
  saved = await ev(() => window.__persisted.at(-1));
  expect(saved.date).toBe("2026-10-09");
  expect(saved.notes).toBe("");
  expect(saved.meals.find((m) => m.name === "🌙 Dinner").items[0].name).toBe("Toast");
  // a stored day without that slot: error, or a new meal when a meal name is given
  await date.fill("2026-10-01");
  await meal.selectOption({ label: "🌙 Dinner" });
  await fillToast();
  await add();
  await expect(msg("Please select or create a meal")).toBeVisible();
  await ev(() => (window.__addMealName = "Late snack"));
  await date.fill("2026-10-02");
  await date.fill("2026-10-01");
  await add();
  await expect(msg("✅ Item added!")).toBeVisible();
  saved = await ev(() => window.__persisted.at(-1));
  expect(saved.date).toBe("2026-10-01");
  expect(saved.meals.map((m) => m.name)).toEqual(["Breakfast", "Late snack"]);
  expect(saved.meals[0].items.map((i) => i.name)).toEqual(["Apple"]);
  expect(saved.meals[1]).toMatchObject({ is_exercise: 0, items: [{ name: "Toast" }] });
  expect(saved.meals[1].id).toBeTruthy();
  // a meal picked by id is used even with a meal name
  await ev(
    () => (window.__allDays = [{ date: "2026-10-01", notes: "", meals: [{ id: "q", name: "Q" }] }]),
  );
  await date.fill("2026-10-02");
  await date.fill("2026-10-01");
  await meal.selectOption("q");
  await fillToast();
  await add();
  await expect(msg("✅ Item added!")).toBeVisible();
  saved = await ev(() => window.__persisted.at(-1));
  expect(saved.meals.map((m) => m.name)).toEqual(["Q"]);
  expect(saved.meals[0].items.map((i) => i.name)).toEqual(["Toast"]);

  expect(sent.length).toBe(2);
  expect(errs).toEqual([]);
});
