// tests/ui/firestore-api.spec.mjs — src/api/firestore.js over the harness's Firestore mock
// (Fix 26 PR 43): recipes and days read / saved / deleted at their paths, read failures
// logged and empty, and the seed data for a new account (pinned to fixtures/seed-days.json).
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const GOLDEN = JSON.parse(readFileSync(new URL("./fixtures/seed-days.json", import.meta.url)));
const U = (x) => `users/u/${x}`;

const start = async (p, init = {}) => {
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/firestoreapi.html");
  await p.waitForFunction(() => window.firestoreApi);
};
const api = (p, fn, arg) =>
  p.evaluate(
    ([src, a]) => new Function("f", "a", `return (${src})(f, a)`)(window.firestoreApi, a),
    [fn.toString(), arg],
  );
const saves = (p) => p.evaluate(() => window.__setDocs);
const errors = (p) => {
  const out = [];
  p.on("console", (m) => m.type() === "error" && out.push(m.text()));
  return out;
};

test("recipes: load sorted by name, save, delete; a failed load logs and gives []", async ({
  page: p,
}) => {
  const logged = errors(p);
  await start(p, {
    __collections: {
      [U("recipes")]: [
        { id: "r2", name: "Pinto Bean Stew", kcal: 300 },
        { id: "r1", name: "apple crumble", kcal: 400 },
        { id: "r3", name: "Omelette", kcal: 200 },
      ],
    },
  });
  const recipes = await api(p, (f) => f.loadAllRecipes("u"));
  expect(recipes.map((r) => r.name)).toEqual(["apple crumble", "Omelette", "Pinto Bean Stew"]); // localeCompare
  expect(recipes[0]).toEqual({ name: "apple crumble", kcal: 400 }); // the fields only
  await api(p, (f) => f.saveRecipe("u", { id: "r9", name: "Toast", kcal: 80 }));
  expect(await saves(p)).toEqual([
    { path: U("recipes/r9"), data: { id: "r9", name: "Toast", kcal: 80 } },
  ]);
  await api(p, (f) => f.deleteRecipe("u", "r2"));
  expect(await p.evaluate(() => window.__deletedDocs)).toEqual([U("recipes/r2")]);
  await p.evaluate(() => (window.__failGetDocs = true));
  expect(await api(p, (f) => f.loadAllRecipes("u"))).toEqual([]);
  expect(logged.some((l) => l.startsWith("loadAllRecipes error:"))).toBe(true);
});

test("days: load newest first, save, load one; a failed load logs and gives []", async ({
  page: p,
}) => {
  const logged = errors(p);
  await start(p, {
    __collections: {
      [U("nutrition_days")]: [
        { id: "2026-10-01", date: "2026-10-01", meals: [] },
        { id: "2026-10-03", date: "2026-10-03", meals: [] },
        { id: "2026-10-02", date: "2026-10-02", meals: [] },
      ],
    },
    __docs: { [U("nutrition_days/2026-10-03")]: { date: "2026-10-03", notes: "n" } },
  });
  const days = await api(p, (f) => f.loadAllDays("u"));
  expect(days.map((d) => d.date)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01"]);
  const recent = await api(p, (f) => f.loadRecentDays("u", 2));
  expect(recent.map((d) => d.date)).toEqual(["2026-10-03", "2026-10-02"]); // the newest 2 only
  await api(p, (f) => f.saveDay("u", { date: "2026-10-04", meals: [] }));
  expect(await saves(p)).toEqual([
    { path: U("nutrition_days/2026-10-04"), data: { date: "2026-10-04", meals: [] } },
  ]);
  expect(await api(p, (f) => f.loadDay("u", "2026-10-03"))).toEqual({
    date: "2026-10-03",
    notes: "n",
  });
  expect(await api(p, (f) => f.loadDay("u", "2026-10-09"))).toBe(null);
  await p.evaluate(() => (window.__failGetDocs = true));
  expect(await api(p, (f) => f.loadAllDays("u"))).toEqual([]);
  expect(logged.some((l) => l.startsWith("loadAllDays error:"))).toBe(true);
  expect(await api(p, (f) => f.loadRecentDays("u", 2))).toEqual([]);
  expect(logged.some((l) => l.startsWith("loadRecentDays error:"))).toBe(true);
  await p.evaluate(() => (window.__failSetDoc = true));
  const err = await api(p, (f) =>
    f.saveDay("u", { date: "x" }).then(
      () => "ok",
      (e) => e.message,
    ),
  );
  expect(err).toBe("Mock setDoc failure"); // save failures propagate
});

test("seedInitialData: the two example days and every starter recipe, newest day first", async ({
  page: p,
}) => {
  await start(p);
  const { returned, recipes } = await api(p, async (f) => ({
    returned: await f.seedInitialData("u"),
    recipes: window.__initialRecipes,
  }));
  const all = await saves(p);
  const dayWrites = all.filter((s) => s.path.startsWith(U("nutrition_days/")));
  const recipeWrites = all.filter((s) => s.path.startsWith(U("recipes/")));
  expect(all.length).toBe(dayWrites.length + recipeWrites.length);
  expect(dayWrites.map((s) => s.path)).toEqual([
    U("nutrition_days/2026-03-04"),
    U("nutrition_days/2026-03-05"),
  ]);
  expect(recipeWrites).toEqual(recipes.map((r) => ({ path: U(`recipes/${r.id}`), data: r })));
  expect(recipes.length).toBeGreaterThan(0);
  // each day is written as returned; returned newest first
  expect(returned.map((d) => d.date)).toEqual(["2026-03-05", "2026-03-04"]);
  expect(dayWrites.map((s) => s.data)).toEqual([returned[1], returned[0]]);
  // ids: one per meal and item, all distinct; the rest pinned to the golden file
  const ids = [];
  const strip = (v) =>
    Array.isArray(v)
      ? v.map(strip)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([k, x]) => (k === "id" ? (ids.push(x), false) : true))
              .map(([k, x]) => [k, strip(x)]),
          )
        : v;
  const bare = strip([returned[1], returned[0]]);
  expect(ids.length).toBe(13 + 33);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^[a-z0-9]{10,}$/.test(id))).toBe(true);
  expect(bare).toEqual(GOLDEN);
  expect(JSON.stringify(bare)).toBe(JSON.stringify(GOLDEN)); // field order too
});
