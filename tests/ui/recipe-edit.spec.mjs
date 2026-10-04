// tests/ui/recipe-edit.spec.mjs — Fix 18 — edit saved recipes, nutrition recalculated
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "@playwright/test";

test("Fix 18 — edit saved recipes, nutrition recalculated", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on(
    "console",
    (m) => m.type() === "error" && errs.push(m.text() + " " + JSON.stringify(m.location())),
  );
  p.on("dialog", (d) => d.dismiss());
  await p.addInitScript(() => {
    window.__noBackfill = true;
  });
  await p.goto("/addentry.html");
  await p.waitForTimeout(500);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = (n) => p.screenshot({ path: test.info().outputPath(`${n}.png`) });
  const openList = async () => {
    await p.getByText("📖 Browse Saved Recipes").click();
    await p.waitForTimeout(200);
  };
  const editRow = async (name) => {
    await p
      .locator("div", { hasText: name })
      .filter({ has: p.locator('button[title="Edit recipe"]') })
      .last()
      .locator('button[title="Edit recipe"]')
      .click();
    await p.waitForTimeout(200);
  };
  const stale = () => p.getByText("nutrition will be recalculated when you save").count();
  const kcalOf = (name) =>
    ev((n) => window.__state.userRecipes.find((r) => r.name === n)?.nutrition?.kcal, name);

  await openList();
  await shot("1_list");
  ok(
    "✏️ button on each saved recipe",
    (await p.locator('button[title="Edit recipe"]').count()) ===
      (await ev(() => window.__state.userRecipes.length)),
  );
  await editRow("Pinto Bean Stew");
  await shot("2_editor");
  ok("editor opens with Edit title", (await p.getByText("✏️ Edit Recipe").count()) === 1);
  ok(
    "prefilled name",
    (await p.locator('input[placeholder="Recipe name"]').inputValue()) === "Pinto Bean Stew",
  );
  ok("no stale note on open", (await stale()) === 0);
  ok(
    "Save Changes + Cancel shown, no Start over",
    (await p.getByText("✓ Save Changes").count()) === 1 &&
      (await p.getByText("Cancel", { exact: true }).count()) === 1 &&
      (await p.getByText("← Start over").count()) === 0,
  );

  // A: name-only edit → no recalc
  await p.locator('input[placeholder="Recipe name"]').fill("Pinto Bean Stew v2");
  ok("name change doesn't flag stale", (await stale()) === 0);
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(300);
  ok("A: no recalc for name-only edit", (await ev(() => window.__recalc.length)) === 0);
  ok(
    "A: saved same id with new name, nutrition kept",
    await ev(() => {
      const s = window.__saved.at(-1);
      return s.id === "r1" && s.name === "Pinto Bean Stew v2" && s.nutrition.kcal === 338;
    }),
  );
  ok(
    "A: back on Saved Recipes list, renamed, no duplicate",
    (await p.getByText("📖 Saved Recipes").count()) === 1 &&
      (await ev(
        () =>
          window.__state.userRecipes.filter((r) => r.id === "r1").length === 1 &&
          window.__state.userRecipes.find((r) => r.id === "r1").name === "Pinto Bean Stew v2",
      )),
  );
  ok("A: form not touched", await ev(() => window.__state.addItem.name === ""));

  // B: servings change → auto recalc on save
  await editRow("Pinto Bean Stew v2");
  await p.locator('input[type="number"][min="1"]').fill("2");
  ok("B: stale note after servings change", (await stale()) === 1);
  await shot("3_stale");
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(80);
  const busy = await p.getByText("⏳ Recalculating & saving…").count();
  await shot("4_saving");
  await p.waitForTimeout(600);
  ok("B: busy label while recalculating", busy === 1);
  ok(
    "B: recalc called once with servings 2",
    await ev(() => window.__recalc.length === 1 && window.__recalc[0].servings === 2),
  );
  const expB = Math.round(1200 / 2 + 10 * 7);
  ok(
    "B: saved with recalculated nutrition",
    (await ev(() => window.__saved.at(-1).nutrition.kcal)) === expB,
    `(kcal ${await ev(() => window.__saved.at(-1).nutrition.kcal)}, expected ${expB})`,
  );
  {
    const k = await kcalOf("Pinto Bean Stew v2");
    const t = await p.locator("text=/^670 kcal$/").count();
    ok("B: list shows new kcal", k === expB && t >= 1, `(state ${k}, dom ${t})`);
  }

  // C: add ingredient, manual recalc, then save → no second recalc
  await editRow("Pinto Bean Stew v2");
  await p.getByText("+ Add ingredient").click();
  await p.locator('input[placeholder="amount"]').last().fill("100g");
  await p.locator('input[placeholder="ingredient"]').last().fill("Spinach");
  ok("C: stale after adding ingredient", (await stale()) === 1);
  await p.getByText("↻ Recalculate nutrition from ingredients above").click();
  await p.waitForTimeout(600);
  ok("C: stale note cleared after manual recalc", (await stale()) === 0);
  const n1 = await ev(() => window.__recalc.length);
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(500);
  ok("C: no extra recalc on save", (await ev(() => window.__recalc.length)) === n1);
  ok(
    "C: saved 8 ingredients, kcal updated",
    await ev(() => {
      const s = window.__saved.at(-1);
      return s.ingredients.length === 8 && s.nutrition.kcal === Math.round(600 + 80);
    }),
  );

  // D: blank ingredient row alone doesn't flag stale; Cancel discards
  await editRow("Pinto Bean Stew v2");
  await p.getByText("+ Add ingredient").click();
  ok("D: empty new row doesn't flag stale", (await stale()) === 0);
  await p.locator('input[placeholder="Recipe name"]').fill("SHOULD NOT SAVE");
  const savedBefore = await ev(() => window.__saved.length);
  await p.getByText("Cancel", { exact: true }).click();
  await p.waitForTimeout(200);
  ok(
    "D: Cancel discards edits",
    (await ev(() => window.__saved.length)) === savedBefore &&
      (await ev(() => !window.__state.userRecipes.some((r) => r.name === "SHOULD NOT SAVE"))),
  );
  ok("D: Cancel returns to list", (await p.getByText("📖 Saved Recipes").count()) === 1);

  // E: recalc failure → error, nothing saved, editor stays open
  await editRow("Paneer Bhurji");
  await p.locator('input[type="number"][min="1"]').fill("3");
  await ev(() => {
    window.__failRecalc = true;
  });
  const sb = await ev(() => window.__saved.length);
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(600);
  await shot("5_error");
  ok(
    "E: error shown, not saved, still editing",
    (await p.getByText("Mock recalc failure").count()) >= 1 &&
      (await ev(() => window.__saved.length)) === sb &&
      (await p.getByText("✏️ Edit Recipe").count()) === 1,
  );
  await ev(() => {
    window.__failRecalc = false;
  });
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(600);
  ok(
    "E: retry succeeds",
    await ev(() => window.__saved.at(-1).id === "r2" && window.__saved.at(-1).servings === 3),
  );

  // F: create flow unchanged
  await p
    .locator("button", { hasText: "×" })
    .first()
    .click()
    .catch(() => {});
  await p.waitForTimeout(200);
  await p.keyboard.press("Escape");
  await p.mouse.click(5, 450);
  await p.waitForTimeout(200);
  await p.getByText("Create with Claude", { exact: false }).first().click();
  await p.waitForTimeout(200);
  ok("F: create title shown", (await p.getByText("🤖 Create Recipe with Claude").count()) === 1);
  await p.locator("textarea").first().fill("dal");
  await p.getByText("Generate Recipe →").click();
  await p.waitForTimeout(300);
  const rc = await ev(() => window.__recalc.length);
  await p.getByText("✓ Save Recipe").click();
  await p.waitForTimeout(400);
  ok(
    "F: new recipe saved without recalc, form filled",
    (await ev(() => window.__recalc.length)) === rc &&
      (await ev(
        () => window.__state.addItem.name === "Test Dal" && window.__state.addItem.kcal === 350,
      )),
  );
  ok(
    "F: Saved Recipes not reopened after create",
    (await p.getByText("📖 Saved Recipes").count()) === 0,
  );
  await shot("6_after_create");

  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
