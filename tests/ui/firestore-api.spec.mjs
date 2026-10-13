// tests/ui/firestore-api.spec.mjs — src/api/firestore.js over the harness's Firestore mock
// (Fix 26 PR 43): recipes and days read / saved / deleted at their paths, read failures
// logged and empty, and the data a new account starts with (an empty day for today, and the starter recipes).
import { test, expect } from "./cover.mjs";

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

test("seedInitialData: today as an empty day with the standard meal slots, and every starter recipe", async ({
  page: p,
}) => {
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await start(p);
  const { returned, recipes, slots, blank } = await api(p, async (f) => ({
    returned: await f.seedInitialData("u"),
    recipes: window.__initialRecipes,
    slots: window.__mealSlots,
    blank: window.__blankPlan,
  }));
  const all = await saves(p);
  const dayWrites = all.filter((s) => s.path.startsWith(U("nutrition_days/")));
  const recipeWrites = all.filter((s) => s.path.startsWith(U("recipes/")));
  const planWrites = all.filter((s) => s.path === U("weight_plan/settings"));
  expect(all.length).toBe(dayWrites.length + recipeWrites.length + planWrites.length);
  // a blank weight plan (Fix 132): every field of the defaults, empty
  expect(planWrites.map((s) => s.data)).toEqual([blank]);
  expect(Object.values(blank).every((v) => v === null || v === "" || Array.isArray(v))).toBe(true);
  expect(blank.planAnchors).toEqual([]);
  expect(blank.sex).toBe("");
  expect(dayWrites.map((s) => s.path)).toEqual([U("nutrition_days/2026-10-04")]);
  expect(recipeWrites).toEqual(recipes.map((r) => ({ path: U(`recipes/${r.id}`), data: r })));
  expect(recipes.length).toBeGreaterThan(0);
  // the one day is written as returned: no entries, a card for each standard slot
  expect(returned.length).toBe(1);
  expect(dayWrites[0].data).toEqual(returned[0]);
  const [day] = returned;
  expect(day.date).toBe("2026-10-04");
  expect(day.notes).toBe("");
  expect(day.meals.map((m) => [m.name, m.is_exercise, m.items])).toEqual(
    slots.map((s) => [s.name, s.is_exercise, []]),
  );
  const ids = day.meals.map((m) => m.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^[a-z0-9]{10,}$/.test(id))).toBe(true);
  expect(JSON.stringify(Object.keys(day))).toBe('["date","notes","meals"]'); // field order
});
