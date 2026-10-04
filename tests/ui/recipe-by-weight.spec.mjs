// tests/ui/recipe-by-weight.spec.mjs — Fix 19 — Wt/portion field and nutrition by weight
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "@playwright/test";

test("Fix 19 — Wt/portion field and nutrition by weight", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("dialog", (d) => d.dismiss());
  await p.addInitScript(() => {
    window.__noBackfill = true;
  });
  await p.goto("/addentry.html");
  await p.waitForTimeout(500);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = (n) => p.screenshot({ path: test.info().outputPath(`${n}.png`) });
  const row = (name) =>
    p
      .locator("div", { hasText: name })
      .filter({ has: p.locator('button[title="Edit recipe"]') })
      .last();
  const openList = async () => {
    await p.getByText("📖 Browse Saved Recipes").click();
    await p.waitForTimeout(200);
  };
  const wt = () => p.locator('label:has-text("Wt/portion") input');

  // 1. Editor field + card tag
  await openList();
  await row("Pinto Bean Stew").locator('button[title="Edit recipe"]').click();
  await p.waitForTimeout(200);
  ok(
    "Wt/portion input next to Cook",
    (await wt().count()) === 1 &&
      (await ev(() => {
        const ls = [...document.querySelectorAll("label")].map((l) => l.textContent);
        const i = ls.findIndex((t) => t.includes("Cook"));
        return ls[i + 1]?.includes("Wt/portion");
      })),
  );
  await wt().fill("225");
  await shot("1_editor");
  ok(
    "Wt/portion doesn't trigger recalc note",
    (await p.getByText("nutrition will be recalculated").count()) === 0,
  );
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(300);
  ok(
    "saved portion_g 225 (number), nutrition unchanged",
    await ev(() => {
      const s = window.__saved.at(-1);
      return s.portion_g === 225 && s.nutrition.kcal === 338;
    }),
  );
  ok("list shows 225 g", (await row("Pinto Bean Stew").getByText("225 g").count()) === 1);
  await row("Pinto Bean Stew").locator("button", { hasText: "👁" }).click();
  await p.waitForTimeout(200);
  await shot("2_card");
  ok(
    "card: Wt/portion tag right after Cook",
    await ev(() => {
      const sp = [...document.querySelectorAll("span")].map((s) => s.textContent);
      const i = sp.findIndex((t) => t.startsWith("Cook "));
      return sp[i + 1] === "Wt/portion 225 g";
    }),
  );
  await p.keyboard.press("Escape");
  await p.mouse.click(5, 880);
  await p.waitForTimeout(200);
  if (await p.getByText("Wt/portion 225 g").count()) {
    await p.locator("button", { hasText: "×" }).last().click();
    await p.waitForTimeout(200);
  }
  ok("card closed", (await p.getByText("Wt/portion 225 g").count()) === 0);

  // 2. Portion modal by grams (local)
  if (!(await p.getByText("📖 Saved Recipes").count())) await openList();
  await row("Pinto Bean Stew").getByText("Pinto Bean Stew", { exact: true }).click();
  await p.waitForTimeout(200);
  ok("base shows · 225 g", (await p.getByText("Per serving (base) · 225 g").count()) === 1);
  ok(
    "portions: 1 portion sat_fat shows 0 not NaN",
    !(await p.locator("body").textContent()).includes("NaN"),
  );
  const sel = p
    .locator("select")
    .filter({ has: p.locator('option[value="g"]') })
    .last();
  const qtyIn = p.locator('input[type="number"][min="0.1"]');
  await sel.selectOption("g");
  await qtyIn.fill("150");
  await p.waitForTimeout(150);
  await shot("3_grams");
  const exp1 = +((338 * 150) / 225).toFixed(1);
  ok(
    "grams: no Calculate button, instant result",
    (await p.getByRole("button", { name: "Calculate" }).count()) === 0 &&
      (await p.getByText("✓ 150 g of Pinto Bean Stew").count()) === 1,
  );
  ok(
    "grams: kcal = 338×150/225",
    (await p.locator("body").textContent()).includes(String(exp1)),
    `(${exp1})`,
  );
  ok("grams: no Claude call", (await ev(() => window.__scale.length)) === 0);
  ok("grams: no hint shown", (await p.getByText("Wt/portion, so Claude").count()) === 0);
  await sel.selectOption("oz");
  await qtyIn.fill("2");
  await p.waitForTimeout(150);
  const exp2 = +((338 * 2 * 28.3495) / 225).toFixed(1);
  ok(
    "oz: local, kcal = 338×2×28.35/225",
    (await p.locator("body").textContent()).includes(String(exp2)) &&
      (await ev(() => window.__scale.length)) === 0,
    `(${exp2})`,
  );
  await sel.selectOption("g");
  await qtyIn.fill("150");
  await p.waitForTimeout(100);
  await p.getByText("✓ Load into Form").click();
  await p.waitForTimeout(200);
  ok(
    "grams: loaded into form",
    await ev(
      (e) =>
        window.__state.addItem.kcal === e &&
        window.__state.addItem.name === "Pinto Bean Stew (150g)" &&
        window.__state.addItem.sat_fat === 0,
      exp1,
    ),
  );

  // 3. Recipe without portion weight → Claude (structured) fallback
  await openList();
  await row("Paneer Bhurji").getByText("Paneer Bhurji", { exact: true }).click();
  await p.waitForTimeout(200);
  await sel.selectOption("g");
  await qtyIn.fill("200");
  await p.waitForTimeout(100);
  await shot("4_no_wt");
  ok(
    "no Wt/portion: hint + Calculate",
    (await p
      .getByText("This recipe has no Wt/portion, so Claude will estimate the portion weight.", {
        exact: false,
      })
      .count()) === 1 && (await p.getByRole("button", { name: "Calculate" }).count()) === 1,
  );
  await ev(() => {
    window.__failScale = true;
  });
  await p.getByRole("button", { name: "Calculate" }).click();
  await p.waitForTimeout(400);
  ok(
    "fallback failure: readable error",
    (await p.getByText("Could not calculate (Mock scale failure)", { exact: false }).count()) === 1,
  );
  await ev(() => {
    window.__failScale = false;
  });
  await p.getByRole("button", { name: "Calculate" }).click();
  await p.waitForTimeout(400);
  await shot("5_fallback");
  ok(
    "fallback: called with g/200/null",
    await ev(() => {
      const c = window.__scale.at(-1);
      return c.id === "r2" && c.qty === 200 && c.unit === "g" && c.portion_g === null;
    }),
  );
  ok(
    "fallback: result shown, rounded",
    (await p.locator("body").textContent()).includes("123.5") &&
      (await p.getByText("✓ Load into Form").count()) === 1,
  );
  await p.getByText("✓ Load into Form").click();
  await p.waitForTimeout(200);
  ok(
    "fallback: loaded",
    await ev(
      () =>
        window.__state.addItem.kcal === 123.5 &&
        window.__state.addItem.name === "Paneer Bhurji (200g)",
    ),
  );

  // 4. ml on a recipe with weight → Claude
  await openList();
  await row("Pinto Bean Stew").getByText("Pinto Bean Stew", { exact: true }).click();
  await p.waitForTimeout(200);
  await sel.selectOption("ml");
  await qtyIn.fill("100");
  await p.waitForTimeout(100);
  ok(
    "ml: hint + Calculate",
    (await p.getByText("Millilitres are worked out by Claude.", { exact: false }).count()) === 1 &&
      (await p.getByRole("button", { name: "Calculate" }).count()) === 1,
  );
  await p.getByRole("button", { name: "Calculate" }).click();
  await p.waitForTimeout(400);
  ok(
    "ml: Claude gets portion_g 225",
    await ev(() => {
      const c = window.__scale.at(-1);
      return c.unit === "ml" && c.portion_g === 225;
    }),
  );
  await sel.selectOption("portion");
  await qtyIn.fill("2");
  await p.waitForTimeout(100);
  ok("portions unchanged: 2 → 676 kcal", (await p.locator("body").textContent()).includes("676"));
  await p.locator("button", { hasText: "Cancel" }).last().click();
  await p.waitForTimeout(150);

  // 5. Clear Wt/portion → null, tag gone
  if (!(await p.getByText("📖 Saved Recipes").count())) await openList();
  await row("Pinto Bean Stew").locator('button[title="Edit recipe"]').click();
  await p.waitForTimeout(200);
  ok("editor prefilled 225", (await wt().inputValue()) === "225");
  await wt().fill("");
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(300);
  ok("cleared → portion_g null", await ev(() => window.__saved.at(-1).portion_g === null));
  await row("Pinto Bean Stew").locator("button", { hasText: "👁" }).click();
  await p.waitForTimeout(200);
  ok(
    "card: no Wt/portion tag when cleared",
    (await p.getByText("Wt/portion", { exact: false }).count()) === 0,
  );
  await p.locator("button", { hasText: "×" }).last().click();
  await p.waitForTimeout(150);

  // 6. New recipe: Claude's estimate fills the field
  await p
    .locator("button", { hasText: "×" })
    .first()
    .click()
    .catch(() => {});
  await p.mouse.click(5, 880);
  await p.waitForTimeout(200);
  await p.getByText("Create with Claude", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p.locator("textarea").first().fill("dal");
  await p.getByText("Generate Recipe →").click();
  await p.waitForTimeout(300);
  ok("create: Wt/portion prefilled from Claude (180)", (await wt().inputValue()) === "180");
  await p.getByText("✓ Save Recipe").click();
  await p.waitForTimeout(300);
  ok("create: saved with portion_g 180", await ev(() => window.__saved.at(-1).portion_g === 180));

  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
