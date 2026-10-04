// tests/ui/recipe-delete-cascade.spec.mjs — Fix 23 — deleting a recipe deletes recipes built on it
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "@playwright/test";

test("Fix 23 — deleting a recipe deletes recipes built on it", async ({ page: p }) => {
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Mock estimate failure|portion weight estimate failed/.test(m.text()) && errs.push(m.text()));
  let dialogs = [], answer = false; p.on("dialog", d => { dialogs.push(d.message()); answer ? d.accept() : d.dismiss(); });
  await p.addInitScript(() => { window.__fastEst = true; });
  await p.goto("/addentry.html"); await p.waitForTimeout(1200);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const ev = (f, a) => p.evaluate(f, a);
  const row = name => p.locator("div", { hasText: name }).filter({ has: p.locator('button[title="Edit recipe"]') }).last();
  const openList = async () => { if (!(await p.getByText("📖 Saved Recipes").count())) { await p.getByText("📖 Browse Saved Recipes").click(); await p.waitForTimeout(200); } };
  const names = () => ev(() => window.__state.userRecipes.map(r => r.name).sort().join("|"));
  // setup: B = Pinto Rice Bowl (uses Pinto Bean Stew), C = Nimbu Pani rebuilt as 1 portion of B
  await p.getByText("Create with Claude", { exact: false }).first().click(); await p.waitForTimeout(200);
  await p.locator("textarea").first().fill("pinto bowl"); await p.getByText("Generate Recipe →").click(); await p.waitForTimeout(800);
  await p.getByText("✓ Save Recipe").click(); await p.waitForTimeout(300);
  await openList(); await row("Nimbu Pani").locator('button[title="Edit recipe"]').click(); await p.waitForTimeout(200);
  while (await p.locator('input[placeholder="ingredient"]').count() > 1) await p.locator('input[placeholder="ingredient"]').last().locator("xpath=following-sibling::button").click();
  await p.locator('input[placeholder="amount"]').first().fill("1 portion"); await p.locator('input[placeholder="ingredient"]').first().fill("Pinto Rice Bowl");
  await p.getByText("✓ Save Changes").click(); await p.waitForTimeout(600);
  const before = await names();
  // 1. Cancel → nothing deleted
  await openList(); await row("Pinto Bean Stew").locator("button", { hasText: "✕" }).click(); await p.waitForTimeout(200);
  ok("confirm lists dependents (direct + indirect)", dialogs.at(-1) === 'Delete "Pinto Bean Stew"?\n\nThis also deletes 2 recipes that use it:\n• Pinto Rice Bowl\n• Nimbu Pani\n\nFood already logged isn\'t affected.', JSON.stringify(dialogs.at(-1)));
  ok("cancel: nothing deleted", (await names()) === before && (await ev(() => window.__deleted.length)) === 0);
  // 2. Unrelated recipe → plain confirm, deletes only it
  answer = true;
  await row("Huel RTD Strawberries & Cream").locator("button", { hasText: "✕" }).click(); await p.waitForTimeout(300);
  ok("unrelated: plain confirm, only it deleted", dialogs.at(-1) === 'Delete "Huel RTD Strawberries & Cream"?' && JSON.stringify(await ev(() => window.__deleted)) === '["r5"]' && !(await names()).includes("Huel"));
  // 3. Accept → A, B, C deleted from Firestore and list
  await row("Pinto Bean Stew").locator("button", { hasText: "✕" }).click(); await p.waitForTimeout(400);
  const del = await ev(() => window.__deleted.slice(1));
  ok("accept: A + B + C deleted in Firestore", del.length === 3 && del[0] === "r1" && del.includes("r3"), JSON.stringify(del));
  ok("accept: list now only unrelated recipes", (await names()) === "Egg White Omelet|Paneer Bhurji", await names());
  ok("notice names what went", (await p.locator("[data-recipe-notice]").textContent()) === "Deleted Pinto Bean Stew and 2 recipes that used it: Pinto Rice Bowl, Nimbu Pani");

  ok("no console/page errors", errs.length === 0, errs.join(" | "));
});
