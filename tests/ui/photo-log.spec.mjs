// tests/ui/photo-log.spec.mjs — "Log from Photo" on Add Entry (Fix 26 PR 12): Claude identifies
// foods in a photo; load one into the form, log all into a meal, or save them as a recipe.
import { test, expect } from "@playwright/test";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TOAST = {
  name: "Toast",
  kcal: 80.25,
  fat: 1,
  sat_fat: 0.2,
  carbs: 15,
  sugar: 1,
  fibre: 1.5,
  net_carbs: 13.5,
  protein: 3,
};
const EGG = { name: "Egg", kcal: 70.1, fat: 5, sat_fat: 1.6, carbs: 0.4, protein: 6.3 };

test("log from photo", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const sent = [];
  let reply = "";
  await p.route("**/api/claude", async (r) => {
    sent.push(JSON.parse(r.request().postData()));
    await new Promise((res) => setTimeout(res, 300));
    r.fulfill({ json: { content: [{ text: reply }] } });
  });
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  const ev = (f, a) => p.evaluate(f, a);
  const file = p.locator('input[type="file"]').first();
  const button = p.getByRole("button", { name: /Take \/ Choose Photo|Analysing/ });
  const choose = () =>
    file.setInputFiles({
      name: "a.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG, "base64"),
    });
  const meal = p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select —" }) })
    .first();

  // Two items (reply in a code fence): loading state, request, preview and list
  reply = "```json\n" + JSON.stringify([TOAST, EGG]) + "\n```";
  await choose();
  await expect(button).toHaveText("⏳ Analysing…");
  await expect(button).toBeDisabled();
  await expect(p.locator('img[alt="food"]')).toHaveCount(0); // no list while analysing
  await expect(
    p.getByText("Claude identified 2 items. Tap to load into the form above, or log all at once."),
  ).toBeVisible();
  await expect(button).toHaveText("📷 Take / Choose Photo");
  await expect(p.locator('img[alt="food"]')).toBeVisible();
  await p.waitForFunction(() => document.querySelector('img[alt="food"]').naturalWidth > 0); // shows the reduced copy
  expect(await file.inputValue()).toBe(""); // the same photo can be chosen again
  const req = sent.at(-1);
  expect([req.model, req.max_tokens]).toEqual(["claude-sonnet-4-6", 1000]);
  expect(req.messages[0].content[0].source.media_type).toBe("image/jpeg");
  expect(req.messages[0].content[1].text).toMatch(
    /^Identify every food item visible in this photo/,
  );
  await expect(p.getByText("80.25 kcal · P:3g F:1g C:15g")).toBeVisible();
  await expect(p.getByText("70.1 kcal · P:6.3g F:5g C:0.4g")).toBeVisible();

  // ↑ Load fills the form with that item
  await p.getByRole("button", { name: "↑ Load" }).nth(1).click();
  expect(await ev(() => window.__state.addItem)).toEqual({
    name: "Egg",
    kcal: 70.1,
    fat: 5,
    sat_fat: 1.6,
    carbs: 0.4,
    protein: 6.3,
  });

  // Log All needs a meal; then both are added to it
  await p.getByRole("button", { name: "✓ Log All 2 Items" }).click();
  await expect(p.getByText("Select a meal slot first")).toBeVisible();
  await ev(() => {
    window.__allDays = [
      {
        date: "2026-10-03",
        notes: "",
        meals: [{ id: "l1", name: "🥗 Lunch", items: [{ id: "x" }] }],
      },
    ];
  });
  await p.locator('input[type="date"]').first().fill("2026-10-03"); // re-render with that day
  await meal.selectOption({ label: "🥗 Lunch" });
  await p.getByRole("button", { name: "✓ Log All 2 Items" }).click();
  await expect(p.getByText("✅ 2 items logged from photo!")).toBeVisible();
  await expect(p.getByRole("button", { name: "↑ Load" })).toHaveCount(0);
  await expect(p.locator('img[alt="food"]')).toHaveCount(0);
  const saved = await ev(() => window.__persisted.at(-1));
  expect(saved.date).toBe("2026-10-03");
  const lunch = saved.meals.find((m) => m.id === "l1").items;
  expect(lunch.map((i) => i.name)).toEqual([undefined, "Toast", "Egg"]);
  expect(lunch[1]).toMatchObject(TOAST);
  expect(lunch[1].id).not.toBe(lunch[2].id);
  expect(await ev(() => window.__currentDay?.date)).toBe("2026-10-03"); // Add Entry day is today
  await expect(p.getByText("✅ 2 items logged from photo!")).toHaveCount(0, { timeout: 4000 }); // fades

  // Another day not loaded yet: its default slots; today's view untouched
  await ev(() => (window.__currentDay = null));
  reply = JSON.stringify([EGG]);
  await choose();
  await p.locator('input[type="date"]').first().fill("2026-10-09");
  await meal.selectOption({ label: "🌙 Dinner" });
  await p.getByRole("button", { name: "✓ Log All 1 Items" }).click();
  await expect(p.getByText("✅ 1 items logged from photo!")).toBeVisible();
  const other = await ev(() => window.__persisted.at(-1));
  expect(other.date).toBe("2026-10-09");
  expect(other.meals.find((m) => m.name === "🌙 Dinner").items[0].name).toBe("Egg");
  expect(await ev(() => window.__currentDay)).toBe(null);

  // One item: singular wording; Save as Recipe opens the builder with the photo's totals
  reply = JSON.stringify([TOAST]);
  await choose();
  await expect(p.getByText("Claude identified 1 item. Tap", { exact: false })).toBeVisible();
  await p.getByRole("button", { name: "📖 Save as Recipe" }).click();
  await expect(p.getByPlaceholder("Recipe name")).toHaveValue("Toast");
  await expect(p.getByPlaceholder("One-line description")).toHaveValue("Saved from photo");
  await expect(p.getByPlaceholder("ingredient")).toHaveValue("Toast");
  await p.getByRole("button", { name: "×" }).first().click();
  await expect(p.getByRole("button", { name: "↑ Load" })).toHaveCount(0);

  // Several items: no name; nutrition summed to 1 dp, missing values as 0
  reply = JSON.stringify([TOAST, EGG]);
  await choose();
  await expect(p.getByText("Claude identified 2 items", { exact: false })).toBeVisible();
  await p.getByRole("button", { name: "📖 Save as Recipe" }).click();
  await expect(p.getByPlaceholder("Recipe name")).toHaveValue("");
  const macro = (name) => p.locator(`xpath=//div[div[normalize-space(.)="${name}"]]/input`).last(); // builder (on top)
  expect(await macro("kcal").inputValue()).toBe("150.4"); // 80.25 + 70.1
  expect(await macro("Sugar").inputValue()).toBe("1"); // Egg has none
  expect(await macro("Net C").inputValue()).toBe("13.5");
  await expect(p.getByPlaceholder("ingredient")).toHaveCount(2);
  await p.getByRole("button", { name: "×" }).first().click();

  // Unreadable reply → message; the list is cleared
  reply = "sorry, no idea";
  await choose();
  await expect(
    p.getByText("Could not analyse photo. Try a clearer image or add items manually."),
  ).toBeVisible();
  await expect(p.getByRole("button", { name: "↑ Load" })).toHaveCount(0);
  await expect(button).toBeEnabled();

  await expect(p.locator('img[alt="food"]')).toHaveCount(0);

  // Cancelling the chooser does nothing
  await file.setInputFiles([]);
  await expect(button).toHaveText("📷 Take / Choose Photo");
  await expect(
    p.getByText("Could not analyse photo. Try a clearer image or add items manually."),
  ).toBeVisible();

  // A new photo clears the old message
  reply = JSON.stringify([EGG]);
  await choose();
  await expect(p.getByText("Could not analyse photo", { exact: false })).toHaveCount(0);
  await expect(p.getByText("Claude identified 1 item", { exact: false })).toBeVisible();

  // Analysing another photo hides the previous list
  reply = JSON.stringify([TOAST]);
  await choose();
  await expect(button).toHaveText("⏳ Analysing…");
  await expect(p.getByRole("button", { name: "↑ Load" })).toHaveCount(0);
  await expect(p.getByText("80.25 kcal · P:3g F:1g C:15g")).toBeVisible();

  expect(errs).toEqual([]);
});
