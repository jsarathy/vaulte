// tests/ui/recipe-weight-guards.spec.mjs — src/api/recipeWeights.js edge cases (Fix 26 PR 4)
// Drives the module directly in the harness page (same mocked Firestore/Claude as the app).
import { test, expect } from "./cover.mjs";
import path from "node:path";

const moduleUrl = "/@fs" + path.resolve("src/api/recipeWeights.js").replaceAll("\\", "/");

test("recipeWeights — backfill and propagation guards", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => (window.__noBackfill = true));
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  const run = (f, a) => p.evaluate(f, a);

  // 1. Backfill: a recipe whose ingredients/servings change while its estimate is pending is skipped
  const backfill = (edit) =>
    run(
      async ({ url, edit }) => {
        const { backfillPortionWeights } = await import(url);
        const X = {
          id: "gx",
          name: "Guard X",
          servings: 2,
          nutrition: { kcal: 100 },
          ingredients: [{ amount: "300g", item: "oats" }],
        };
        window.__saved.length = 0;
        window.__estDelay["Guard X"] = 600;
        window.__setRecipes([X]);
        await new Promise((r) => setTimeout(r, 100));
        const ref = { current: [X] };
        const set = (f) => {
          ref.current = f(ref.current);
          window.__setRecipes(ref.current);
        };
        const done = backfillPortionWeights("u", () => ref.current, set);
        await new Promise((r) => setTimeout(r, 150));
        if (edit) set((prev) => prev.map((r) => ({ ...r, servings: 3 })));
        await done;
        return { recipe: ref.current[0], saved: window.__saved.map((s) => s.id) };
      },
      { url: moduleUrl, edit },
    );
  const plain = await backfill(false);
  expect(plain.recipe.portion_g, "control: unedited recipe gets its estimate").toBe(150);
  expect(plain.saved).toEqual(["gx"]);
  const edited = await backfill(true);
  expect(edited.recipe.portion_g ?? null, "edited while pending: no weight").toBeNull();
  expect(edited.recipe.servings).toBe(3);
  expect(edited.saved, "edited while pending: nothing saved").toEqual([]);

  // 2. Propagation, exact delta but B's weight can't be shifted (A has no Wt/portion) → re-estimated
  const out = await run(
    async ({ url }) => {
      const { propagateRecipeChange } = await import(url);
      const A = { id: "ga", name: "Guard Stew", servings: 1, nutrition: { kcal: 100 } };
      const B = {
        id: "gb",
        name: "Guard Bowl",
        servings: 2,
        portion_g: 250,
        portion_g_source: "estimated",
        nutrition: { kcal: 300 },
        ingredients: [
          { amount: "1 portion", item: "Guard Stew" },
          { amount: "200g", item: "rice" },
        ],
      };
      const A2 = { ...A, nutrition: { kcal: 140 } };
      window.__saved.length = 0;
      window.__est.length = 0;
      window.__recalc.length = 0;
      let list = [A2, B];
      const res = await propagateRecipeChange({
        uid: "u",
        oldA: A,
        newA: A2,
        recipes: list,
        setUserRecipes: (f) => (list = f(list)),
      });
      return {
        updated: res.updated,
        B: res.list.find((r) => r.id === "gb"),
        est: [...window.__est],
        recalc: window.__recalc.length,
        saved: window.__saved.map((s) => s.id),
      };
    },
    { url: moduleUrl },
  );
  expect(out.updated).toEqual(["Guard Bowl"]);
  expect(out.B.nutrition.kcal, "kcal by delta: 300 + 40 ÷ 2").toBe(320);
  expect(out.recalc, "no Claude nutrition call").toBe(0);
  expect(out.est, "weight re-estimated").toEqual(["Guard Bowl"]);
  expect(out.B.portion_g, "(200 g rice + 100 g stew) ÷ 2").toBe(150);
  expect(out.B.portion_g_source).toBe("estimated");
  expect(out.saved).toEqual(["gb"]);
  expect(errs).toEqual([]);
});
