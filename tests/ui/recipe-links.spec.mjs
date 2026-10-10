// tests/ui/recipe-links.spec.mjs — Fix 21 — recipes built from saved recipes
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "./cover.mjs";

test("Fix 21 — recipes built from saved recipes", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !/Mock estimate failure|portion weight estimate failed/.test(m.text()) &&
      errs.push(m.text()),
  );
  await p.addInitScript(() => {
    window.__fastEst = true;
  });
  await p.goto("/addentry.html");
  await p.waitForTimeout(1200);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = (n) => p.screenshot({ path: test.info().outputPath(`${n}.png`) });
  const row = (name) =>
    p
      .locator("div", { hasText: name })
      .filter({ has: p.locator('button[title="Edit recipe"]') })
      .last();
  const openList = async () => {
    if (!(await p.getByText("📖 Saved Recipes").count())) {
      await p.getByText("📖 Browse Saved Recipes").click();
      await p.waitForTimeout(200);
    }
  };
  const rec = (name) => ev((n) => window.__state.userRecipes.find((r) => r.name === n), name);
  const badges = () => p.locator("[data-link-badge]").allTextContents();
  const lastRecalc = () => ev(() => window.__recalc.at(-1));
  const pinto = await rec("Pinto Bean Stew");
  ok("setup: Pinto has estimated Wt/portion", pinto.portion_g === 328, `(${pinto.portion_g})`);
  const RICE = 1200 + 10; // mock recalc for 1 ingredient, servings 1

  // 1. Create with Claude from a saved recipe
  await p.getByText("Create with Claude", { exact: false }).first().click();
  await p.waitForTimeout(200);
  await p
    .locator("textarea")
    .first()
    .fill("250g of my pinto bean stew mixed with 350g cooked basmati rice, 2 bowls");
  const nRec0 = await ev(() => window.__recalc.length);
  await p.getByText("Generate Recipe →").click();
  await p.waitForTimeout(800);
  await shot("1_create");
  ok(
    "create: saved recipe names sent to Claude",
    await ev(
      () =>
        window.__createArgs.at(-1).names.includes("Pinto Bean Stew") &&
        window.__createArgs.at(-1).names.length === 5,
    ),
  );
  const b1 = await badges();
  ok(
    "create: linked badge on the stew row only",
    b1.length === 1 && b1[0] === "📖 Saved recipe · 250 g · 0.76 portions · 258 kcal",
    JSON.stringify(b1),
  );
  ok(
    "create: Claude only calculated the rice (servings 1)",
    (await ev((n) => window.__recalc.length === n + 1, nRec0)) &&
      JSON.stringify(await lastRecalc()) ===
        JSON.stringify({
          servings: 1,
          ingredients: [{ amount: "350g", item: "Cooked basmati rice" }],
        }),
  );
  const exp1 = Math.round((((338 * 250) / 328 + RICE) / 2) * 10) / 10;
  ok(
    "create: kcal = (stew 257.6 + rice) ÷ 2",
    (await p.locator('input[type="number"]').nth(1).inputValue()) === String(exp1) ||
      ((await ev(() => true)) && (await p.locator("body").innerHTML()).includes(`value="${exp1}"`)),
    `(${exp1})`,
  );
  ok(
    "create: Wt/portion = (250 + 350) ÷ 2 = 300 (est.)",
    (await p.locator('label:has-text("Wt/portion") input').inputValue()) === "300" &&
      (await p.locator('label:has-text("Wt/portion")').getByText("(est.)").count()) === 1,
  );
  ok("create: no stale note", (await p.getByText("nutrition will be recalculated").count()) === 0);
  ok(
    "datalist offers saved recipes",
    await ev(() =>
      [...document.querySelectorAll("#vaulte-saved-recipe-names option")]
        .map((o) => o.value)
        .includes("Pinto Bean Stew"),
    ),
  );
  await p.getByText("✓ Save Recipe").click();
  await p.waitForTimeout(300);
  const bowl = await rec("Pinto Rice Bowl");
  ok(
    "create: saved with combined nutrition + weight",
    bowl.nutrition.kcal === exp1 && bowl.portion_g === 300 && bowl.portion_g_source === "estimated",
  );

  // 2. Edit: switch to 1 portion of the stew
  await openList();
  await row("Pinto Rice Bowl").locator('button[title="Edit recipe"]').click();
  await p.waitForTimeout(200);
  await p.locator('input[placeholder="amount"]').first().fill("1 portion");
  ok(
    "edit: badge updates to 1 portion · 328 g · 338 kcal",
    (await badges())[0] === "📖 Saved recipe · 328 g · 1 portion · 338 kcal",
    JSON.stringify(await badges()),
  );
  ok("edit: stale note shown", (await p.getByText("nutrition will be recalculated").count()) === 1);
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(600);
  const bowl2 = await rec("Pinto Rice Bowl");
  ok(
    "edit: kcal (338 + rice) ÷ 2, weight (328+350)/2",
    bowl2.nutrition.kcal === Math.round(((338 + RICE) / 2) * 10) / 10 && bowl2.portion_g === 339,
    `(${bowl2.nutrition.kcal}, ${bowl2.portion_g})`,
  );
  ok(
    "edit: Claude again saw only the rice",
    JSON.stringify((await lastRecalc()).ingredients) ===
      JSON.stringify([{ amount: "350g", item: "Cooked basmati rice" }]),
  );

  // 3. Unusable amount → amber badge, Claude gets both
  await openList();
  await row("Pinto Rice Bowl").locator('button[title="Edit recipe"]').click();
  await p.waitForTimeout(200);
  await p.locator('input[placeholder="amount"]').first().fill("2 tbsp");
  await shot("2_amber");
  ok(
    "bad unit: amber badge",
    (await badges())[0].includes(
      "use an amount in g, kg, oz or portions; Claude will estimate it instead",
    ),
  );
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(600);
  ok(
    "bad unit: Claude gets both ingredients with real servings",
    (await lastRecalc()).ingredients.length === 2 && (await lastRecalc()).servings === 2,
  );

  // 4. Linked recipe with no Wt/portion (Nimbu); only-linked recipe → no Claude
  await openList();
  await row("Pinto Rice Bowl").locator('button[title="Edit recipe"]').click();
  await p.waitForTimeout(200);
  await p.locator('input[placeholder="amount"]').first().fill("200g");
  await p.locator('input[placeholder="ingredient"]').first().fill("nimbu  PANI");
  ok(
    "no Wt/portion: amber badge, case-insensitive match",
    (await badges())[0].includes("Nimbu Pani has no Wt/portion yet — use portions"),
  );
  await p.locator('input[placeholder="amount"]').first().fill("2 portions");
  await p.locator('button:has-text("×")').nth(2).click(); // remove rice row (row ×: [0]=header, [1]=row1, [2]=row2)
  await p.waitForTimeout(100);
  ok(
    "rice removed",
    (await p.locator('input[placeholder="ingredient"]').count()) === 1,
    `(${await p.locator('input[placeholder="ingredient"]').count()})`,
  );
  const nRec = await ev(() => window.__recalc.length),
    nEst = await ev(() => window.__est.length);
  await p.getByText("✓ Save Changes").click();
  await p.waitForTimeout(600);
  const bowl3 = await rec("Pinto Rice Bowl");
  ok(
    "only linked: no Claude nutrition call, kcal = 2×9 ÷ 2",
    (await ev((n) => window.__recalc.length === n, nRec)) && bowl3.nutrition.kcal === 9,
    `(${bowl3.nutrition.kcal})`,
  );
  ok(
    "linked recipe without weight: Claude weighs it, (100 g) ÷ 2 = 50 est.",
    (await ev((n) => window.__est.length === n + 1, nEst)) &&
      bowl3.portion_g === 50 &&
      bowl3.portion_g_source === "estimated",
    `(${bowl3.portion_g})`,
  );

  // 5. Self-link ignored
  await openList();
  await row("Pinto Bean Stew").locator('button[title="Edit recipe"]').click();
  await p.waitForTimeout(200);
  await p.getByText("+ Add ingredient").click();
  await p.locator('input[placeholder="ingredient"]').last().fill("Pinto Bean Stew");
  await p.locator('input[placeholder="amount"]').last().fill("100g");
  ok(
    "self: no badge, not in its own list",
    (await badges()).length === 0 &&
      !(await ev(() =>
        [...document.querySelectorAll("#vaulte-saved-recipe-names option")]
          .map((o) => o.value)
          .includes("Pinto Bean Stew"),
      )),
  );
  await p.getByText("Cancel", { exact: true }).click();
  await p.waitForTimeout(150);

  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
