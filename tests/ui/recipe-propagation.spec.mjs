// tests/ui/recipe-propagation.spec.mjs — Fix 22 — dependent recipes update automatically
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "@playwright/test";

test("Fix 22 — dependent recipes update automatically", async ({ page: p }) => {
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Mock estimate failure|portion weight estimate failed/.test(m.text()) && errs.push(m.text()));
  await p.addInitScript(() => { window.__fastEst = true; });
  await p.goto("/addentry.html"); await p.waitForTimeout(1200);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a); const shot = n => p.screenshot({ path: test.info().outputPath(`${n}.png`) });
  const row = name => p.locator("div", { hasText: name }).filter({ has: p.locator('button[title="Edit recipe"]') }).last();
  const openList = async () => { if (!(await p.getByText("📖 Saved Recipes").count())) { await p.getByText("📖 Browse Saved Recipes").click(); await p.waitForTimeout(200); } };
  const rec = id => ev(i => window.__state.userRecipes.find(r => r.id === i), id);
  const byName = n => ev(x => window.__state.userRecipes.find(r => r.name === x), n);
  const edit = async name => { await openList(); await row(name).locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200); };
  const save = async (ms = 700) => { await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(ms); };
  const kcalInput = () => p.locator('div:has(> div:text-is("kcal")) input').last();
  const notice = async () => (await p.locator("[data-recipe-notice]").count()) ? p.locator("[data-recipe-notice]").textContent() : "";
  const counts = () => ev(() => [window.__recalc.length, window.__est.length]);
  const r1 = (x) => Math.round(x * 10) / 10;

  // Setup: B = Pinto Rice Bowl (250 g stew + 350 g rice, serves 2); C = Nimbu Pani rebuilt as 1 portion of B
  await p.getByText("Create with Claude", { exact: false }).first().click(); await p.waitForTimeout(200);
  await p.locator("textarea").first().fill("pinto bowl"); await p.getByText("Generate Recipe →").click(); await p.waitForTimeout(800);
  await p.getByText("✓ Save Recipe").click(); await p.waitForTimeout(300);
  const B0 = await byName("Pinto Rice Bowl");
  await edit("Nimbu Pani");
  const nIng = await p.locator('input[placeholder="ingredient"]').count();
  for (let i = 1; i < nIng; i++) { await p.locator('[data-link-badge], input[placeholder="ingredient"]').count(); await p.locator('input[placeholder="ingredient"]').last().locator("xpath=following-sibling::button").click(); }
  await p.locator('input[placeholder="amount"]').first().fill("1 portion"); await p.locator('input[placeholder="ingredient"]').first().fill("Pinto Rice Bowl");
  await p.locator('input[type="number"][min="1"]').fill("1");
  await save();
  const C0 = await byName("Nimbu Pani");
  ok("setup: C = 1 portion of B", C0.ingredients.length === 1 && C0.nutrition.kcal === B0.nutrition.kcal && C0.portion_g === B0.portion_g, `(C ${C0.nutrition.kcal}/${C0.portion_g}, B ${B0.nutrition.kcal}/${B0.portion_g})`);

  // 1. Change A's kcal by hand → B and C follow, no Claude
  const A0 = await rec("r1");
  await edit("Pinto Bean Stew");
  const c1 = await counts();
  await kcalInput().fill("400"); await save();
  const B1 = await byName("Pinto Rice Bowl"), C1 = await byName("Nimbu Pani");
  const expB1 = r1(B0.nutrition.kcal + (400 - 338) * 250 / A0.portion_g / 2);
  ok("A kcal 338→400: B += 62×250/328 ÷ 2", B1.nutrition.kcal === expB1, `(${B1.nutrition.kcal} vs ${expB1})`);
  ok("…C (1 portion of B) follows B", C1.nutrition.kcal === expB1);
  ok("…no Claude calls", JSON.stringify(await counts()) === JSON.stringify(c1));
  ok("…B/C weights unchanged", B1.portion_g === B0.portion_g && C1.portion_g === C0.portion_g);
  ok("…notice lists both", (await notice()) === "Also updated 2 recipes that use it: Pinto Rice Bowl, Nimbu Pani", `"${await notice()}"`); await shot("1_notice");
  ok("…saved to Firestore", await ev(k => window.__saved.some(s => s.name === "Pinto Rice Bowl" && s.nutrition.kcal === k), expB1));

  // 2. Rename A → B's ingredient renamed, link kept, nutrition unchanged
  await edit("Pinto Bean Stew");
  await p.locator('input[placeholder="Recipe name"]').fill("Pinto Stew v2"); await save();
  const B2 = await byName("Pinto Rice Bowl");
  ok("rename: B ingredient now 'Pinto Stew v2', kcal same", B2.ingredients[0].item === "Pinto Stew v2" && B2.nutrition.kcal === expB1);
  await edit("Pinto Rice Bowl");
  ok("rename: B still shows linked badge", (await p.locator("[data-link-badge]").first().textContent()).startsWith("📖 Saved recipe · 250 g"));
  // weigh B at 310
  await p.locator('label:has-text("Wt/portion") input').fill("310"); await save(300);

  // 3. A's Wt/portion 328 → 400 (weighed): grams link rescales B; weighed B weight kept; C (portion of B) weight follows? (B weight weighed 310 — C estimated)
  await edit("Pinto Stew v2");
  const c3 = await counts();
  await p.locator('label:has-text("Wt/portion") input').fill("400"); await save();
  const B3 = await byName("Pinto Rice Bowl"), C3 = await byName("Nimbu Pani");
  const expB3 = r1(expB1 + (400 * 250 / 400 - 400 * 250 / A0.portion_g) / 2);
  ok("A weight 328→400: B kcal rescaled", B3.nutrition.kcal === expB3, `(${B3.nutrition.kcal} vs ${expB3})`);
  ok("…weighed B keeps 310", B3.portion_g === 310 && B3.portion_g_source === "weighed");
  ok("…C kcal follows B", C3.nutrition.kcal === expB3);
  ok("…no Claude calls", JSON.stringify(await counts()) === JSON.stringify(c3));

  // 4. A's weight cleared → B's grams link unusable → full recalculation by Claude; failure → amber notice
  await edit("Pinto Stew v2");
  await ev(() => { window.__failRecalc = true; });
  await p.locator('label:has-text("Wt/portion") input').fill(""); await save(900);
  ok("failure: A saved, amber notice", (await rec("r1")).portion_g === null && (await notice()).startsWith("Saved, but couldn't update recipes that use it (Mock recalc failure)"), `"${await notice()}"`); await shot("2_fail");
  await ev(() => { window.__failRecalc = false; });
  await edit("Pinto Stew v2");
  const c4 = await counts();
  await p.locator('label:has-text("Wt/portion") input').fill("328"); await save(1200);
  ok("weight restored: B fully recalculated by Claude (link was unusable before)", (await counts())[0] > c4[0] && (await notice()).includes("Pinto Rice Bowl"), `"${await notice()}"`);

  // 5. Cycle A ↔ B terminates
  await edit("Pinto Stew v2");
  await p.getByText("+ Add ingredient").click();
  await p.locator('input[placeholder="amount"]').last().fill("1 portion"); await p.locator('input[placeholder="ingredient"]').last().fill("Pinto Rice Bowl");
  const sv = await ev(() => window.__saved.length);
  await save(2500);
  const nSaved = await ev(n => window.__saved.length - n, sv);
  ok("cycle: finishes, bounded saves", nSaved >= 2 && nSaved <= 4 && await p.getByText("✏️ Edit Recipe").count() === 0, `(${nSaved} saves)`);

  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
