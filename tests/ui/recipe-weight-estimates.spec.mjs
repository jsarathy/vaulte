// tests/ui/recipe-weight-estimates.spec.mjs — Fix 20 — estimated Wt/portion backfill
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "@playwright/test";

test("Fix 20 — estimated Wt/portion backfill", async ({ page: p }) => {
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !m.text().includes("Mock estimate failure") && !m.text().startsWith("portion weight estimate failed") && errs.push(m.text()));
  p.on("dialog", d => d.dismiss());
  await p.goto("/addentry.html"); await p.waitForTimeout(150);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a); const shot = n => p.screenshot({ path: test.info().outputPath(`${n}.png`) });
  const row = name => p.locator("div", { hasText: name }).filter({ has: p.locator('button[title="Edit recipe"]') }).last();
  const openList = async () => { if (!(await p.getByText("📖 Saved Recipes").count())) { await p.getByText("📖 Browse Saved Recipes").click(); await p.waitForTimeout(200); } };
  const wt = () => p.locator('label:has-text("Wt/portion") input');
  const rec = id => ev(i => window.__state.userRecipes.find(r => r.id === i), id);
  const saves = id => ev(i => window.__saved.filter(s => s.id === i), id);

  // Race: user weighs Paneer (r2) while its estimate is still pending
  await openList(); await row("Paneer Bhurji").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(150);
  ok("race: editor opened before Paneer estimate returned", await ev(() => !window.__state.userRecipes.find(r=>r.id==="r2").portion_g));
  await wt().fill("300"); await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(3500);
  ok("race: weighed 300 kept, estimate not saved over it", (await rec("r2")).portion_g === 300 && (await rec("r2")).portion_g_source === "weighed" && (await saves("r2")).every(s => s.portion_g_source !== "estimated"));

  // Backfill results
  const all = await ev(() => window.__state.userRecipes.map(r => [r.id, r.name, r.portion_g, r.portion_g_source]));
  ok("backfill tried every recipe once", (await ev(() => [...window.__est].sort().join("|"))) === "Egg White Omelet|Huel RTD Strawberries & Cream|Nimbu Pani|Paneer Bhurji|Pinto Bean Stew");
  const pinto = await rec("r1");
  ok("Pinto: 1309 g ÷ 4 → 328 g est. (rounded)", pinto.portion_g === Math.round((606+102+100+100+201+100+100)/4 + 0.4) && pinto.portion_g_source === "estimated", `(${pinto.portion_g})`);
  ok("Pinto saved to Firestore with estimate", (await saves("r1")).some(s => s.portion_g === pinto.portion_g && s.portion_g_source === "estimated"));
  const nimbu = all.find(a => a[1] === "Nimbu Pani");
  ok("failed estimate: recipe left without weight, nothing saved", !nimbu[2] && (await saves(nimbu[0])).length === 0);
  ok("nutrition untouched by backfill", pinto.nutrition.kcal === 338);

  // Display
  await openList(); await shot("1_list");
  ok("list: '303 g (est.)'", await row("Pinto Bean Stew").getByText(`${pinto.portion_g} g (est.)`).count() === 1);
  ok("list: weighed Paneer has no (est.)", await row("Paneer Bhurji").getByText("300 g", { exact: true }).count() === 1);
  await row("Pinto Bean Stew").locator("button", { hasText: "👁" }).click(); await p.waitForTimeout(200); await shot("2_card");
  ok("card: 'Wt/portion 303 g (est.)' after Cook", await ev(g => { const sp=[...document.querySelectorAll("span")].map(s=>s.textContent); const i=sp.findIndex(t=>t.startsWith("Cook ")); return sp[i+1] === `Wt/portion ${g} g (est.)`; }, pinto.portion_g));
  await p.locator("button", { hasText: "×" }).last().click(); await p.waitForTimeout(150);
  await openList(); await row("Pinto Bean Stew").getByText("Pinto Bean Stew", { exact: true }).click(); await p.waitForTimeout(200);
  ok("portion box: base '· 303 g (est.)'", await p.getByText(`Per serving (base) · ${pinto.portion_g} g (est.)`).count() === 1);
  const sel = p.locator("select").filter({ has: p.locator('option[value="g"]') }).last();
  await sel.selectOption("g"); await p.locator('input[type="number"][min="0.1"]').fill("150"); await p.waitForTimeout(150); await shot("3_grams");
  const e1 = +(338*150/pinto.portion_g).toFixed(1);
  ok("grams scale instantly from estimate", (await p.locator("body").textContent()).includes(String(e1)) && await p.getByRole("button", { name: "Calculate" }).count() === 0, `(${e1})`);
  await p.locator("button", { hasText: "Cancel" }).last().click(); await p.waitForTimeout(150);

  // Estimated recipe: ingredient change → weight re-estimated with nutrition
  await openList(); await row("Pinto Bean Stew").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  ok("editor shows (est.)", await p.locator('label:has-text("Wt/portion")').getByText("(est.)").count() === 1); await shot("4_editor_est");
  await p.locator('input[placeholder="amount"]').first().fill("806g");
  const nEst = await ev(() => window.__est.length);
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(700);
  const pinto2 = await rec("r1");
  ok("estimated + ingredients changed → re-estimated on save", await ev(() => window.__est.length) === nEst + 1 && pinto2.portion_g === Math.round(1509/4 + 0.4) && pinto2.portion_g_source === "estimated", `(${pinto2.portion_g})`);
  ok("…and nutrition recalculated", await ev(() => window.__recalc.length) >= 1 && pinto2.nutrition.kcal !== 338);

  // Manual recalc button also re-estimates when estimated
  await openList(); await row("Pinto Bean Stew").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  await p.locator('input[type="number"][min="1"]').fill("5");
  await p.getByText("↻ Recalculate nutrition from ingredients above").click(); await p.waitForTimeout(700);
  ok("manual recalc: weight re-estimated (1509/5)", await wt().inputValue() === String(Math.round(1509/5 + 0.4)) && await p.locator('label:has-text("Wt/portion")').getByText("(est.)").count() === 1);

  // Typing a weighed value: (est.) gone, kept on later ingredient changes
  await wt().fill("330");
  ok("typed weight: (est.) removed", await p.locator('label:has-text("Wt/portion")').getByText("(est.)").count() === 0);
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(400);
  ok("typed weight saved as weighed", (await rec("r1")).portion_g === 330 && (await rec("r1")).portion_g_source === "weighed");
  await openList(); await row("Pinto Bean Stew").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  await p.locator('input[type="number"][min="1"]').fill("4");
  const nEst2 = await ev(() => window.__est.length);
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(700);
  ok("weighed + servings changed → nutrition recalculated, weight kept, no estimate call", (await rec("r1")).portion_g === 330 && (await rec("r1")).portion_g_source === "weighed" && await ev(() => window.__est.length) === nEst2);

  // Clearing → null, re-run backfill picks it (and Nimbu) up again but nothing else
  await openList(); await row("Egg White Omelet").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  await wt().fill(""); await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(300);
  ok("cleared → portion_g null, source null", await ev(() => { const s = window.__saved.at(-1); return s.portion_g === null && s.portion_g_source === null; }));
  const before = await ev(() => window.__est.length);
  await ev(() => window.__backfill()); await p.waitForTimeout(800);
  const again = await ev(b => window.__est.slice(b).sort().join("|"), before);
  ok("next load only estimates recipes without a weight", again === "Egg White Omelet|Nimbu Pani", `(${again})`);

  // Create flow rounds Claude's estimate and marks it
  await p.locator("button", { hasText: "×" }).first().click().catch(()=>{}); await p.mouse.click(5, 880); await p.waitForTimeout(200);
  await p.getByText("Create with Claude", { exact: false }).first().click(); await p.waitForTimeout(200);
  await p.locator("textarea").first().fill("dal"); await p.getByText("Generate Recipe →").click(); await p.waitForTimeout(300);
  ok("create: 180.4 → 180 (est.)", await wt().inputValue() === "180" && await p.locator('label:has-text("Wt/portion")').getByText("(est.)").count() === 1);
  await p.getByText("✓ Save Recipe").click(); await p.waitForTimeout(300);
  ok("create: saved 180 estimated", await ev(() => { const s = window.__saved.at(-1); return s.portion_g === 180 && s.portion_g_source === "estimated"; }));

  // Close is ignored while saving
  await openList(); await row("Huel RTD Strawberries & Cream").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  await p.locator('input[type="number"][min="1"]').fill("3");
  await ev(() => { window.__estDelay["Huel RTD Strawberries & Cream"] = 1500; });
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(100);
  await p.locator("button", { hasText: "×" }).first().click(); await p.mouse.click(5, 880); await p.waitForTimeout(100);
  ok("× / backdrop ignored while saving", await p.getByText("✏️ Edit Recipe").count() === 1 && await p.getByText("⏳ Recalculating & saving…").count() === 1);
  await p.waitForTimeout(1800);
  ok("save then completes and closes to list", await p.getByText("✏️ Edit Recipe").count() === 0 && await p.getByText("📖 Saved Recipes").count() === 1 && (await rec("r5")).servings === 3);
  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
