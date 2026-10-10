// tests/ui/tracker-startup.spec.mjs — what NutritionTracker loads when it opens (Fix 26 PR 18):
// days (or seeded days), saved recipes, calculator inputs (and saving them), weight plan,
// weight and body logs, chat history, Polar connection and sessions, failures, and the
// ?polar=connected / ?polar=error return from Polar's sign-in.
import { test, expect } from "./cover.mjs";

const P = (x) => `users/u/${x}`;
const FULL = {
  __docs: {
    [P("settings/calculator")]: {
      sex: "f",
      age: 40,
      height: "tall", // not a number: kept at the default
      weight: 70,
      protein: 1.6,
      fatPct: 25,
    },
    [P("weight_plan/settings")]: { age: 61, heightCm: 170 },
    [P("claude_chat/conversation")]: {
      history: [
        { role: "user", content: "hi there" },
        { role: "assistant", content: "hello back" },
      ],
    },
    [P("polar/connection")]: { connected: true, last_sync_at: "2026-10-04T09:05:00" },
  },
  __collections: {
    [P("weight_log")]: [
      { id: "2026-10-03", week: 3 },
      { id: "2026-10-01", week: 1 },
      { id: "2026-09-30", date: null, week: 9 }, // a stored null date sorts first
    ],
    [P("body_log")]: [{ id: "2026-10-03" }, { id: "2026-10-01" }],
    [P("polar_sessions")]: [
      { id: "a", sport: "RUNNING", start_time: "2026-10-01T08:00:00", calories: 1 },
      { id: "b", sport: "CYCLING", start_time: "2026-10-03T08:00:00", calories: 2 },
      { id: "c", sport: "ROWING", start_time: "2026-10-04T08:00:00", calories: 3, logged: true },
      { id: "d", sport: "WALKING", calories: 4 },
    ],
  },
  __recipes: [
    {
      id: "r1",
      name: "Soup",
      servings: 2,
      nutrition: { kcal: 100 },
      ingredients: [{ amount: "300g", item: "water" }],
    },
  ],
};

const start = async (p, init, path = "/tracker.html", fixTime = true) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  if (fixTime) await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto(path);
};
const watch = (p) => {
  const out = { errs: [], logged: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  return out;
};
const tab = async (p, name) => {
  await p.getByRole("button", { name, exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" }); // the tab's code downloads on first open
};
const openDay = (p) =>
  p.evaluate(
    () =>
      [...document.querySelectorAll("div[title]")].find(
        (el) => el.style.fontFamily && el.style.background === "rgb(55, 138, 221)",
      )?.childNodes[0].nodeValue ?? null,
  );
const calculator = (p) =>
  Promise.all(
    ["Sex", "Age", "Height cm", "Weight kg", "Protein target", "Fat % of calories"].map((l) =>
      p.getByText(l, { exact: true }).locator("..").locator("input, select").inputValue(),
    ),
  );
const calcSaves = (p) =>
  p.evaluate(() => window.__setDocs.filter((s) => s.path === "users/u/settings/calculator"));

test("start-up: everything loaded", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { ...FULL, __getDocDelays: { [P("settings/calculator")]: 400 } });
  await expect(p.getByText("Loading your log…")).toBeVisible();
  await p.getByText("October 2026").waitFor();
  await expect(p.getByText("Loading your log…")).toHaveCount(0);
  const ev = (f, a) => p.evaluate(f, a);

  // Days: the first one is open; Compare shows the days with entries (up to 5)
  expect(await openDay(p)).toBe("1");
  await tab(p, "Compare");
  const heads = p.locator('div[style*="repeat(5"] > div > div:first-child > span');
  expect(await heads.allTextContents()).toEqual([
    expect.stringMatching(/^Thu,? 1 Oct$/),
    expect.stringMatching(/^Sun,? 4 Oct$/),
    "— pick —",
    "— pick —",
    "— pick —",
  ]);

  // Calculator: saved values (a bad number keeps the default). The restored values are
  // saved back once (the save effect sees them change after loading); then each change
  expect(await calculator(p)).toEqual(["f", "40", "165", "70", "1.6", "25"]);
  await p.waitForTimeout(800);
  expect((await calcSaves(p)).map((s) => s.data.age)).toEqual([40]);
  const age = p.getByText("Age", { exact: true }).locator("..").locator("input");
  await age.fill("41");
  await age.fill("42");
  await expect.poll(() => calcSaves(p)).toHaveLength(2); // 600 ms after the last change
  await p.waitForTimeout(700);
  expect((await calcSaves(p)).length).toBe(2);
  expect((await calcSaves(p))[1].data).toEqual({
    sex: "f",
    age: 42,
    height: 165,
    weight: 70,
    protein: 1.6,
    fatPct: 25,
    updated_at: await ev(() => new Date().toISOString()),
  });

  // Weight plan merged over the defaults; the editor starts from it
  await tab(p, "Weight");
  await expect(p.getByText("61 yr")).toBeVisible();
  await expect(p.getByText("170 cm")).toBeVisible();
  await expect(p.getByText("83.8 kg").first()).toBeVisible(); // default start weight
  // weight log in date order (the table shows latest first)
  const weeks = await p
    .locator("tbody tr td:first-child input")
    .evaluateAll((es) => es.map((e) => e.value));
  expect(weeks).toEqual(["3", "1", "9"]);
  await p.getByText("✏ Edit").click();
  await expect(p.locator('input[value="61"]')).toHaveCount(1);

  // Body log in date order
  await tab(p, "Body");
  const bodyDates = await p
    .locator("tbody tr td:first-child")
    .evaluateAll((es) => es.map((e) => e.textContent));
  expect(bodyDates).toEqual(["2026-10-03", "2026-10-01"]);

  // Days come with the default meal slots filled in (Add Food lists them with their ids)
  await tab(p, "Add entry");
  const mealOptions = await p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select —" }) })
    .first()
    .locator("option")
    .evaluateAll((os) => os.map((o) => [o.value, o.text]));
  const dinner = mealOptions.find(([, t]) => t === "🌙 Dinner");
  expect(dinner && !dinner[0].startsWith("__slot__")).toBe(true);

  // Polar: connected, last sync, unlogged sessions newest first (undated last)
  await expect(p.getByText("Connected", { exact: true })).toBeVisible();
  await expect(p.getByText("Synced 4 Oct, 09:05")).toBeVisible();
  await expect(p.getByText("3 unlogged sessions")).toBeVisible();
  const order = await p.evaluate(() =>
    ["Cycling", "Running", "Walking"]
      .map((n) => [n, document.body.innerHTML.indexOf(">" + n + "<")])
      .sort((a, b) => a[1] - b[1])
      .map((x) => x[0]),
  );
  expect(order).toEqual(["Cycling", "Running", "Walking"]);
  await expect(p.getByText("Rowing", { exact: true })).toHaveCount(0);

  // Chat: earlier conversation shown and carried into the next question; date = open day
  await p.getByTitle("Nutrition assistant").click();
  await expect(p.getByText("hi there", { exact: true })).toBeVisible();
  await expect(p.getByText("hello back", { exact: true })).toBeVisible();
  expect(await p.getByText("hi there", { exact: true }).evaluate((e) => e.style.alignSelf)).toBe(
    "flex-end",
  );
  expect(
    await p.getByText("hello back", { exact: true }).evaluate((e) => e.style.alignSelf),
  ).not.toBe("flex-end");
  expect(await p.locator('input[type="date"]').last().inputValue()).toBe("2026-10-01");
  await ev(() => (window.__chatReply = "sure"));
  const box = p.locator("textarea, input[type=text]").last();
  await box.fill("and now?");
  await box.press("Enter");
  await expect.poll(() => ev(() => window.__chatCalls?.length || 0)).toBe(1);
  expect(await ev(() => window.__chatCalls[0])).toEqual([
    { role: "user", content: "hi there" },
    { role: "assistant", content: "hello back" },
    { role: "user", content: "and now?" },
  ]);

  // Recipes: loaded, and one without a Wt/portion gets an estimate in the background
  await expect.poll(() => ev(() => window.__saved.find((r) => r.id === "r1")?.portion_g)).toBe(150);
  expect(w.errs).toEqual([]);
  expect(w.logged).toEqual([]);
});

test("start-up: saved recipes are available at once", async ({ page: p }) => {
  const stew = { id: "r2", name: "Stew", servings: 1, portion_g: 300, nutrition: { kcal: 300 } };
  await start(p, { __recipes: [stew] }); // has a Wt/portion: no background update follows
  await p.getByText("October 2026").waitFor();
  await tab(p, "Add entry");
  await p.getByText("📖 Browse Saved Recipes").click();
  await expect(p.getByText("Stew", { exact: true })).toBeVisible();
});

test("start-up: nothing saved yet", async ({ page: p }) => {
  const w = watch(p);
  const seeded = { date: "2026-10-02", notes: "", meals: [] };
  await start(p, { __days: [], __seedDays: [seeded] });
  await p.getByText("October 2026").waitFor();
  expect(await openDay(p)).toBe("2"); // seeded days used
  await tab(p, "Compare");
  expect(await calculator(p)).toEqual(["m", "60", "165", "84", "1.4", "30"]);
  const age = p.getByText("Age", { exact: true }).locator("..").locator("input");
  await age.fill("59");
  await expect.poll(() => calcSaves(p)).toHaveLength(1);
  await tab(p, "Weight");
  await expect(p.getByText("60 yr")).toBeVisible(); // default plan
  await tab(p, "Add entry");
  await expect(p.getByText("Connected", { exact: true })).toHaveCount(0);
  await p.getByTitle("Nutrition assistant").click();
  await expect(p.getByText("hi there")).toHaveCount(0);
  expect(w.errs).toEqual([]);
  expect(w.logged).toEqual([]);
});

test("start-up: no days at all; empty chat history; connection fields missing", async ({
  page: p,
}) => {
  await start(p, {
    __days: [],
    __seedDays: [],
    __docs: {
      [P("claude_chat/conversation")]: { history: [] },
      [P("polar/connection")]: {},
    },
  });
  await p.getByText("October 2026").waitFor();
  expect(await openDay(p)).toBe(null);
  await tab(p, "Add entry");
  await expect(p.getByText("Connected", { exact: true })).toHaveCount(0);
  await p.getByTitle("Nutrition assistant").click();
  await expect(p.locator('input[type="date"]').last()).toHaveValue("2026-10-04"); // today
});

test("start-up: optional parts can fail; the rest still loads", async ({ page: p }) => {
  const w = watch(p);
  await start(p, {
    ...FULL,
    __failPaths: [P("settings/calculator"), P("claude_chat/conversation")],
  });
  await p.getByText("October 2026").waitFor();
  await expect.poll(() => w.logged.some((l) => l.startsWith("calculator load failed"))).toBe(true);
  expect(w.logged.some((l) => l.startsWith("chat history load failed"))).toBe(true);
  await tab(p, "Compare");
  expect(await calculator(p)).toEqual(["m", "60", "165", "84", "1.4", "30"]);
  const age = p.getByText("Age", { exact: true }).locator("..").locator("input");
  await age.fill("59");
  await expect.poll(() => calcSaves(p)).toHaveLength(1); // saving still works
  await tab(p, "Weight");
  await expect(p.getByText("61 yr")).toBeVisible();
  await tab(p, "Add entry");
  await expect(p.getByText("3 unlogged sessions")).toBeVisible();
  expect(w.errs).toEqual([]);
});

test("start-up: the weight plan fails → logged, the first screen and the rest still load", async ({
  page: p,
}) => {
  const w = watch(p);
  await start(p, { ...FULL, __failPaths: [P("weight_plan/settings")] });
  await p.getByText("October 2026").waitFor();
  await expect(p.getByText("Loading your log…")).toHaveCount(0);
  expect(w.logged.some((l) => l.startsWith("weight load failed"))).toBe(true);
  expect(await openDay(p)).toBe("1"); // the weight plan is not needed for the first screen
  await tab(p, "Compare");
  expect(await calculator(p)).toEqual(["f", "40", "165", "70", "1.6", "25"]);
});

test("start-up: recipes failing → logged, no day opened; the other parts still load", async ({
  page: p,
}) => {
  const w = watch(p);
  await start(p, { ...FULL, __failRecipes: true });
  await p.getByText("October 2026").waitFor();
  expect(w.logged.some((l) => l.startsWith("Init error:"))).toBe(true);
  expect(await openDay(p)).toBe(null); // days are set last, after every part has loaded
  await tab(p, "Compare");
  expect(await calculator(p)).toEqual(["f", "40", "165", "70", "1.6", "25"]); // loaded in parallel
  await p.getByText("Age", { exact: true }).locator("..").locator("input").fill("59");
  await expect.poll(() => calcSaves(p)).toHaveLength(1); // so saving works
});

test("start-up: not signed in", async ({ page: p }) => {
  await start(p, { ...FULL, __userId: "" });
  await p.getByText("October 2026").waitFor();
  expect(await p.evaluate(() => window.__getDocPaths || [])).toEqual([]);
  expect(await openDay(p)).toBe(null);
});

// The message lasts 6 s from page load; on a slow CI shard the lazy Add entry tab can arrive late.
test("returning from Polar sign-in", async ({ page: p }) => {
  await start(p, FULL, "/tracker.html?polar=connected&x=1", false);
  await p.getByText("October 2026").waitFor();
  await tab(p, "Add entry");
  const ok = p.getByText("Polar connected — click Sync to pull sessions.");
  await expect(ok).toBeVisible();
  expect(await ok.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(46, 125, 50)");
  expect(new URL(p.url()).search).toBe("");
  const reads = await p.evaluate(() =>
    window.__getDocPaths.filter((x) => x === "users/u/polar/connection"),
  );
  expect(reads.length).toBe(2); // read again after the return
  await p.waitForTimeout(4500);
  await expect(ok).toBeVisible();
  await expect(ok).toHaveCount(0, { timeout: 3000 }); // gone after 6 s

  await start(p, { __docs: {} }, "/tracker.html?polar=error", false);
  await p.getByText("October 2026").waitFor();
  await tab(p, "Add entry");
  const bad = p.getByText("Polar connection failed.");
  await expect(bad).toBeVisible();
  expect(await bad.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(198, 40, 40)");
  expect(new URL(p.url()).search).toBe("");
  await expect(bad).toHaveCount(0, { timeout: 8000 });

  await start(p, { __docs: {} }, "/tracker.html?polar=other", false);
  await p.getByText("October 2026").waitFor();
  expect(new URL(p.url()).search).toBe("?polar=other");
});
