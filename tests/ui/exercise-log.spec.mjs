// tests/ui/exercise-log.spec.mjs — "Log Manual Exercise" on Add Entry (Fix 26 PR 11): search,
// pick, calculate (kcal, HR zone, fat burn), log into a meal slot, errors, reset, closing.
import { test, expect } from "./cover.mjs";

test("log manual exercise", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  const ev = (f, a) => p.evaluate(f, a);
  const open = () => p.getByRole("button", { name: "🏋️ Log Manual Exercise" }).click();
  const title = p.getByText("🏋️ Log Exercise", { exact: true });
  const search = p.getByPlaceholder("Search exercise… e.g. cycling, yoga, running");
  const field = (label) => p.locator(`xpath=//div[div[normalize-space(.)="${label}"]]/input`);
  const calc = p.getByRole("button", { name: "Calculate", exact: true });
  const pick = (name) => p.getByText(name, { exact: true }).click();
  const names = () =>
    p.locator("xpath=//div[div[text()[contains(., ' · MET ')]]]/div[1]").allTextContents();
  const result = p
    .locator("div", { has: p.getByText("🔥 Kcal Burned") })
    .filter({ hasText: "· " })
    .last();
  const slot = p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select meal slot —" }) });
  const logIt = p.getByRole("button", { name: "✓ Log It" });

  // Opens with search focused; filter by name or category, any case
  await open();
  await expect(title).toBeVisible();
  await expect(search).toBeFocused();
  expect((await names()).length).toBe(57);
  await search.fill("RUNNING, F");
  expect(await names()).toEqual(["Running, fast (7.5 mph)"]);
  await search.fill("cardio");
  expect((await names()).length).toBeGreaterThan(5);
  await expect(p.getByText("Cardio · MET 2.5")).toBeVisible();
  await search.fill("running");

  // Nothing picked → Calculate does nothing; weight shown as 84 kg
  await calc.click();
  await expect(p.getByText("🔥 Kcal Burned")).toHaveCount(0);
  expect(await field("Weight (kg)").inputValue()).toBe("84");
  expect(await field("Duration (min)").inputValue()).toBe("30");

  // Pick (highlighted), 45 min, no HR: 9.8 MET × 84 kg × 0.75 h = 617 kcal, Zone 3, 60% fat
  await pick("Running, moderate (6 mph)");
  await expect(p.getByText("Running, moderate (6 mph)", { exact: true }).locator("..")).toHaveCSS(
    "background-color",
    "rgb(230, 241, 251)",
  );
  await field("Duration (min)").fill("");
  await calc.click();
  await expect(p.getByText("🔥 Kcal Burned")).toHaveCount(0); // no duration → nothing
  await field("Duration (min)").fill("45");
  await calc.click();
  await expect(p.getByText("Running, moderate (6 mph) · 45 min")).toBeVisible();
  await expect(result).toContainText(
    "🔥 Kcal Burned617 kcal❤️ HR ZoneZone 3🧈 Fat Burn %60%🧈 Fat Burned41g (370 kcal)",
  );

  // With an average HR: Zone 4, 40% fat; picking another exercise clears the result
  await field("Avg HR (opt)").fill("120");
  await calc.click();
  await expect(result).toContainText("❤️ HR ZoneZone 4🧈 Fat Burn %40%🧈 Fat Burned27g (247 kcal)");
  await field("Avg HR (opt)").fill("9"); // max rounds to 10 → 90% → Zone 5, 20% fat
  await calc.click();
  await expect(result).toContainText("❤️ HR ZoneZone 5🧈 Fat Burn %20%");
  await pick("Running, fast (7.5 mph)");
  await expect(p.getByText("🔥 Kcal Burned")).toHaveCount(0);
  await field("Avg HR (opt)").fill("");
  await calc.click();
  await expect(result).toContainText("🔥 Kcal Burned775 kcal"); // 12.3 × 84 × 0.75
  await field("Avg HR (opt)").fill("130"); // typed after Calculate: not used, but reset after logging

  // Log: needs a meal slot; slots offered for the Add Entry day
  await logIt.click();
  await expect(p.getByText("Select a meal slot")).toBeVisible();
  expect(await slot.locator("option").allTextContents()).toEqual([
    "— select meal slot —",
    "☕ Breakfast",
    "🏋️ Morning Exercise",
    "🥤 Post-Workout",
    "🥗 Lunch",
    "🍎 Snack",
    "🚴 Afternoon Exercise",
    "🌙 Dinner",
    "🌆 Evening Exercise",
  ]);
  await slot.selectOption({ label: "🚴 Afternoon Exercise" });
  await ev(() => (window.__failPersist = true));
  await logIt.click();
  await expect(p.getByText("Failed to log: Mock persist failure")).toBeVisible();
  await ev(() => (window.__failPersist = false));
  await logIt.click();
  await expect(title).toHaveCount(0);
  const saved = await ev(() => window.__persisted.at(-1));
  expect(saved.date).toBe("2026-10-03");
  expect(saved.notes).toBe("Rest day");
  const meal = saved.meals.find((m) => m.name === "🚴 Afternoon Exercise");
  expect(meal.items).toHaveLength(1);
  expect(meal.items[0]).toMatchObject({
    name: "Running, fast (7.5 mph) (45 min)",
    kcal: -775,
    fat: 0,
    sat_fat: 0,
    carbs: 0,
    sugar: 0,
    fibre: 0,
    net_carbs: 0,
    protein: 0,
    is_exercise: 1,
    fat_burned_g: 52,
    fat_burned_kcal: 465,
  });
  expect(meal.items[0].id).toMatch(/^[0-9a-z]{10,}$/);
  expect(saved.meals.find((m) => m.name === "Breakfast").id).toBe("m2026-10-03"); // existing kept
  expect(await ev(() => window.__currentDay?.date)).toBe("2026-10-03"); // Add Entry day is today

  // After logging, everything is reset
  await open();
  expect(await search.inputValue()).toBe("");
  expect(await field("Duration (min)").inputValue()).toBe("30");
  expect(await field("Avg HR (opt)").inputValue()).toBe("");
  await expect(p.getByText("🔥 Kcal Burned")).toHaveCount(0);
  await pick("Yoga, Hatha");
  await calc.click();
  expect(await slot.inputValue()).toBe("");

  // × keeps duration/HR but reopening clears search, pick and result; backdrop closes too
  await field("Duration (min)").fill("20");
  await search.fill("yoga");
  await p.getByRole("button", { name: "×" }).first().click();
  await expect(title).toHaveCount(0);
  await open();
  expect(await search.inputValue()).toBe("");
  expect(await field("Duration (min)").inputValue()).toBe("20");
  await expect(p.getByText("🔥 Kcal Burned")).toHaveCount(0);
  await calc.click();
  await expect(p.getByText("🔥 Kcal Burned")).toHaveCount(0); // the pick was cleared too
  await p.mouse.click(5, 300);
  await expect(title).toHaveCount(0);

  // Another day: logged, but today's view isn't touched
  await ev(() => (window.__currentDay = null));
  await p.locator('input[type="date"]').first().fill("2026-10-09");
  await open();
  await pick("Yoga, Hatha");
  await calc.click();
  await slot.selectOption({ label: "🌙 Dinner" });
  await logIt.click();
  await expect(title).toHaveCount(0);
  const other = await ev(() => window.__persisted.at(-1));
  expect(other.date).toBe("2026-10-09");
  expect(other.meals.find((m) => m.name === "🌙 Dinner").items[0].name).toBe(
    "Yoga, Hatha (20 min)",
  );
  expect(await ev(() => window.__currentDay)).toBe(null);

  // A day already loaded: its own meals are offered, and the entry is added after what's there
  await ev(() => {
    window.__allDays = [
      {
        date: "2026-10-01",
        notes: "",
        meals: [{ id: "b1", name: "Breakfast", items: [{ id: "a" }] }],
      },
    ];
  });
  await p.locator('input[type="date"]').first().fill("2026-10-01");
  await open();
  await pick("Yoga, Hatha");
  await calc.click();
  await slot.selectOption({ label: "Breakfast" });
  await logIt.click();
  await expect(title).toHaveCount(0);
  const loaded = await ev(() => window.__persisted.at(-1));
  expect(loaded.meals.find((m) => m.id === "b1").items.map((i) => i.id)[0]).toBe("a");
  expect(loaded.meals.find((m) => m.id === "b1").items).toHaveLength(2);

  expect(errs).toEqual([]);
});
