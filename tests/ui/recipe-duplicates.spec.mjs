// tests/ui/recipe-duplicates.spec.mjs — Fix 25 — no duplicate recipe names
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "@playwright/test";

test("Fix 25 — no duplicate recipe names", async ({ page: p }) => {
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Mock estimate failure|portion weight estimate failed|404/.test(m.text()) && errs.push(m.text()));
  let dialogs = []; p.on("dialog", d => { dialogs.push(d.message()); d.accept(); });
  let kcal = 0, zero = true;
  await p.route("**/api/claude", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ content:[{ type:"text", text: JSON.stringify(zero ? { kind:"INGREDIENT", display_name:"Apple (1 portion)", kcal:0, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 } : { kind:"INGREDIENT", display_name:"Apple (1 portion)", kcal, fat:0.2, sat_fat:0, carbs:14, sugar:10, fibre:2.4, net_carbs:11.6, protein:0.3 }) }] }) }));
  await p.addInitScript(() => { window.__fastEst = true; });
  await p.goto("/addentry.html"); await p.waitForTimeout(1200);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a);
  const row = name => p.locator("div", { hasText: name }).filter({ has: p.locator('button[title="Edit recipe"]') }).last();
  const openList = async () => { if (!(await p.getByText("📖 Saved Recipes").count())) { await p.getByText("📖 Browse Saved Recipes").click(); await p.waitForTimeout(200); } };
  const apples = () => ev(() => window.__state.userRecipes.filter(r => r.name.toLowerCase() === "apple"));
  const getNutrition = async (name) => {
    const box = p.locator('input[placeholder^="e.g. Pinto bean stew"]');
    await box.fill(name); await box.blur(); await p.waitForTimeout(500);
     await p.locator('label:has-text("Save to Saved recipes") input').check({ timeout: 4000 });
    await p.locator("#qty-confirm-btn").click(); await p.waitForTimeout(600);
  };
  // Seed a legacy duplicate pair "Apple" (as old app versions left behind)
  await ev(() => {});
  // 1. First save creates Apple
  await getNutrition("Apple");
  const a1 = await apples();
  ok("first save (no macros): one Apple", a1.length === 1 && a1[0].nutrition.kcal === 0);
  // 2. Second save of same name (different case) overwrites same id
  kcal = 60; zero = false;
  await p.locator("button", { hasText: "✕ Clear" }).click().catch(()=>{}); await p.waitForTimeout(150);
  await getNutrition("apple");
  const a2 = await apples();
  ok("second save: still one Apple, same id, new values", a2.length === 1 && a2[0].id === a1[0].id && a2[0].nutrition.kcal === 60, JSON.stringify(a2.map(x=>[x.id,x.name,x.nutrition.kcal])));
  ok("Firestore: saved over the same id, nothing deleted", await ev(id => window.__saved.filter(s => s.id === id).length === 2 && window.__deleted.length === 0, a1[0].id));
  // 3. Editor: renaming to an existing name is blocked
  await openList(); await row("Paneer Bhurji").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  await p.locator('input[placeholder="Recipe name"]').fill("  pinto bean STEW ");
  const sv = await ev(() => window.__saved.length);
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(300);

  ok("rename clash: error shown, nothing saved", await p.getByText('A saved recipe is already called "Pinto Bean Stew" — choose another name.').count() === 1 && await ev(n => window.__saved.length === n, sv));
  await p.locator('input[placeholder="Recipe name"]').fill("");
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(200);
  ok("blank name blocked", await p.getByText("Give the recipe a name.").count() === 1 && await ev(n => window.__saved.length === n, sv));
  await p.locator('input[placeholder="Recipe name"]').fill("Paneer Bhurji");
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(400);
  ok("own name still saves", await ev(n => window.__saved.length === n + 1, sv));
  // 4. Legacy duplicate: two "Pinto Bean Stew" + Bowl using it; delete one copy → Bowl stays
  if (await p.getByText("📖 Saved Recipes").count()) { await p.locator('div:has(> div:text-is("📖 Saved Recipes")) > button').click(); await p.waitForTimeout(200); }
  await p.getByText("Create with Claude", { exact: false }).first().click(); await p.waitForTimeout(200);
  await p.locator("textarea").first().fill("pinto bowl"); await p.getByText("Generate Recipe →").click(); await p.waitForTimeout(800);
  await p.getByText("✓ Save Recipe").click(); await p.waitForTimeout(300);
  await ev(() => window.__setRecipes(prev => [...prev, { ...prev.find(r => r.id === "r1"), id: "r1dup" }]));
  await p.waitForTimeout(150);
  await openList();
  await p.locator("div", { hasText: "Pinto Bean Stew" }).filter({ has: p.locator('button[title="Edit recipe"]') }).filter({ hasNotText: "Bowl" }).last().locator("button", { hasText: "✕" }).click(); await p.waitForTimeout(300);
  ok("duplicate delete: plain confirm, only that copy goes, Bowl kept", dialogs.at(-1) === 'Delete "Pinto Bean Stew"?' && await ev(() => window.__deleted.length === 1 && window.__state.userRecipes.some(r => r.name === "Pinto Rice Bowl") && window.__state.userRecipes.filter(r => r.name === "Pinto Bean Stew").length === 1), JSON.stringify([dialogs.at(-1), await ev(() => window.__deleted)]));
  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
