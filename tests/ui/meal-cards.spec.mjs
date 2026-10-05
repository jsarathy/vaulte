// tests/ui/meal-cards.spec.mjs — the Daily log's meal cards (Fix 26 PR 29): collapsing (and
// remembering it), subtotals, food vs workout cards, column headers, empty cards, item rows
// (recipe link, Polar link, plain), removing an entry, the Apple Watch card's toggle, pinned
// in tests/ui/fixtures/meal-cards.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test meal-cards --workers=1
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/meal-cards.json", import.meta.url);
const UPDATE = !!process.env.UPDATE_GOLDEN;
const golden = UPDATE ? {} : JSON.parse(readFileSync(GOLDEN_FILE, "utf8"));
test.afterAll(() => {
  if (UPDATE) writeFileSync(GOLDEN_FILE, JSON.stringify(golden, null, 2) + "\n");
});
const matchGolden = (name, value) => {
  if (UPDATE) golden[name] = value;
  else expect(value, name).toEqual(golden[name]);
};

test.use({ timezoneId: "Europe/London" });
const LS = "vaulte_collapsed_meals";

const DAY = {
  date: "2026-10-04",
  notes: "",
  meals: [
    {
      id: "mB",
      name: "☕ Breakfast",
      items: [
        // a saved recipe's portion: a link
        {
          id: "f1",
          name: "Soup (1 portion)",
          recipe_name: "Soup",
          kcal: 250.26,
          fat: 10.04,
          carbs: 20,
          sugar: 3.55,
          fibre: 4,
          net_carbs: 16,
          protein: 12.5,
        },
        // missing figures show as 0; a recipe name with no saved recipe is plain text
        { id: "f2", name: "Toast", recipe_name: "Gone", kcal: 80 },
      ],
    },
    {
      id: "mX",
      name: "🏋️ Morning Exercise",
      is_exercise: 1,
      items: [{ id: "x1", name: "Run (30 min)", kcal: -300, is_exercise: 1 }],
    },
    // a card counts as a workout when any entry is one
    {
      id: "mC",
      name: "Garden",
      items: [
        { id: "c1", name: "Digging", kcal: -120, is_exercise: 1 },
        { id: "c2", name: "Lemonade", kcal: 90, carbs: 22, polar_session_id: "s9" },
      ],
    },
  ],
};
const SOUP = {
  id: "r1",
  name: "Soup",
  servings: 2,
  nutrition: { kcal: 100 },
  ingredients: [{ amount: "300g", item: "water" }],
};

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript(
    ({ i, LS }) => {
      if (!sessionStorage.getItem("started")) {
        localStorage.removeItem(LS);
        if (i.__collapsed) localStorage.setItem(LS, i.__collapsed);
        sessionStorage.setItem("started", "1");
      }
      Object.assign(window, i);
    },
    { i: { __days: [DAY], __docs: {}, __recipes: [SOUP], ...init }, LS },
  );
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await expect(p.getByText("net kcal of")).toBeVisible();
};
const watch = (p) => {
  const out = { errs: [], dialogs: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("dialog", (d) => {
    out.dialogs.push(d.message());
    p.__confirm === false ? d.dismiss() : d.accept();
  });
  return out;
};
const describe = (root) =>
  [root, ...root.querySelectorAll("*")].map((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join("");
    const style = (el.getAttribute("style") ?? "").replace(
      "border-width: medium; border-style: none; border-color: currentcolor; border-image: none;",
      "border: none;",
    );
    const attrs = ["width", "height", "viewBox", "d", "cx", "cy", "r", "stroke", "fill"]
      .concat(["stroke-width", "stroke-linecap", "colspan"])
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`);
    return [el.tagName, style, ...attrs, ...(own.trim() ? [`"${own}"`] : [])].join(" | ");
  });
// a meal card: the outer box around the table whose first row names the meal
const card = (p, name) =>
  p
    .locator("table")
    .filter({ has: p.locator("tr").first().filter({ hasText: name }) })
    .locator("xpath=../..");
const shape = (p, name) => card(p, name).evaluate(describe);
const head = (p, name) => card(p, name).locator("tr").first();
const rows = (p, name) =>
  card(p, name)
    .locator("tr")
    .evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
const stored = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), LS);

test("cards start collapsed; opening and closing is remembered", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  // default slots fill in around the logged meals, all collapsed
  expect(await rows(p, "Breakfast")).toEqual([
    ["☕ Breakfast", "330.3", "10g", "20g", "3.5g", "4g", "16g", "12.5g", ""],
  ]);
  expect(await rows(p, "Lunch")).toEqual([["🥗 Lunch", "—", "—", "—", "—", "—", "—", "—", ""]]);
  matchGolden("collapsed-food", await shape(p, "Breakfast"));
  matchGolden("collapsed-empty", await shape(p, "Lunch"));
  matchGolden("collapsed-workout", await shape(p, "Morning Exercise"));
  matchGolden("collapsed-mixed", await shape(p, "Garden"));
  matchGolden("collapsed-empty-workout", await shape(p, "Afternoon Exercise")); // the slot alone

  await head(p, "Breakfast").click();
  expect(await rows(p, "Breakfast")).toEqual([
    ["☕ Breakfast", "330.3", "10g", "20g", "3.5g", "4g", "16g", "12.5g", ""],
    ["Item", "kcal", "Fat", "Carbs", "Sugar", "Fibre", "Net C", "Prot", ""],
    ["Soup (1 portion)", "250.3", "10g", "20g", "3.5g", "4g", "16g", "12.5g", ""],
    ["Toast", "80", "0g", "0g", "0g", "0g", "0g", "0g", ""],
  ]);
  matchGolden("open-food", await shape(p, "Breakfast"));
  expect(await stored(p)).toEqual({ mB: false });
  await head(p, "Lunch").click();
  expect(await rows(p, "Lunch")).toEqual([
    ["🥗 Lunch", "—", "—", "—", "—", "—", "—", "—", ""],
    ["No items logged yet"],
  ]);
  matchGolden("open-empty", await shape(p, "Lunch"));
  await head(p, "Morning Exercise").click();
  matchGolden("open-workout", await shape(p, "Morning Exercise"));
  await head(p, "Garden").click();
  matchGolden("open-mixed", await shape(p, "Garden"));
  // Lemonade has a session id but isn't a workout: plain text
  await expect(card(p, "Garden").locator("span", { hasText: "Lemonade" })).toHaveCount(0);

  // closing again; the state survives a reload
  await head(p, "Lunch").click();
  expect(await rows(p, "Lunch")).toHaveLength(1);
  const st = await stored(p);
  expect(st).toMatchObject({ mB: false, mX: false, mC: false });
  expect(Object.values(st)).toEqual([false, true, false, false]); // Lunch: closed again
  await p.reload();
  await p.getByText("net kcal of").waitFor();
  expect(await rows(p, "Breakfast")).toHaveLength(4);
  expect(await rows(p, "Lunch")).toHaveLength(1);
  expect(w.errs).toEqual([]);
});

test("stored state: explicit true / false", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { __collapsed: JSON.stringify({ mB: false, mX: true }) });
  expect(await rows(p, "Breakfast")).toHaveLength(4);
  expect(await rows(p, "Morning Exercise")).toHaveLength(1);
  await head(p, "Morning Exercise").click();
  expect(await stored(p)).toEqual({ mB: false, mX: false });
  expect(await rows(p, "Morning Exercise")).toHaveLength(3);
  await head(p, "Breakfast").click();
  expect(await stored(p)).toEqual({ mB: true, mX: false });
  expect(w.errs).toEqual([]);
});

test("unreadable stored state: everything collapsed, replaced", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { __collapsed: "{oops" });
  expect(await rows(p, "Breakfast")).toHaveLength(1);
  expect(await stored(p)).toEqual({});
  await head(p, "Breakfast").click();
  expect(await stored(p)).toEqual({ mB: false });
  expect(w.errs).toEqual([]);
});

test("a saved recipe opens from its entry, without toggling the card", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { __collapsed: JSON.stringify({ mB: false }) });
  await expect(card(p, "Breakfast").locator("span", { hasText: "Toast" })).toHaveCount(0);
  await card(p, "Breakfast").locator("span", { hasText: "Soup (1 portion)" }).click();
  await expect(p.getByText("water", { exact: true })).toBeVisible(); // the recipe's ingredients
  expect(await rows(p, "Breakfast")).toHaveLength(4); // the click doesn't toggle the card
  expect(w.errs).toEqual([]);
});

test("removing an entry: confirm first, the card stays as it is", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { __collapsed: JSON.stringify({ mB: false }) });
  const toast = card(p, "Breakfast").locator("tr", { hasText: "Toast" });
  const x = toast.getByRole("button");
  // hovering turns the × red
  await x.dispatchEvent("mouseover");
  await expect(x).toHaveCSS("color", "rgb(198, 40, 40)");
  await x.dispatchEvent("mouseout");
  await expect(x).toHaveCSS("color", "rgb(156, 163, 175)");
  p.__confirm = false;
  await x.click();
  expect(w.dialogs).toEqual(["Remove this item?"]);
  await expect(toast).toHaveCount(1);
  p.__confirm = true;
  await x.click();
  await expect(toast).toHaveCount(0);
  expect(await rows(p, "Breakfast")).toEqual([
    ["☕ Breakfast", "250.3", "10g", "20g", "3.5g", "4g", "16g", "12.5g", ""],
    ["Item", "kcal", "Fat", "Carbs", "Sugar", "Fibre", "Net C", "Prot", ""],
    ["Soup (1 portion)", "250.3", "10g", "20g", "3.5g", "4g", "16g", "12.5g", ""],
  ]);
  const saved = await p.evaluate(() => window.__savedDays.at(-1));
  expect(saved.meals.find((m) => m.id === "mB").items.map((i) => i.id)).toEqual(["f1"]);
  expect(await stored(p)).toEqual({ mB: false });
  expect(w.errs).toEqual([]);
});

test("the Apple Watch card opens and closes, remembered with the rest", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  const apple = p.getByText("⌚ Apple Watch Activity");
  const none = p.getByText("No Apple Watch data synced for this day yet");
  await expect(none).toHaveCount(0); // collapsed at first
  await apple.click();
  expect(await stored(p)).toEqual({ apple_activity: false });
  await expect(none).toBeVisible();
  await apple.click();
  expect(await stored(p)).toEqual({ apple_activity: true });
  await expect(none).toHaveCount(0);
  expect(w.errs).toEqual([]);
});

test("no day open: a prompt instead of the log", async ({ page: p }) => {
  const w = watch(p);
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript(() => Object.assign(window, { __days: [], __seedDays: [] }));
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await expect(p.getByText("Select a day to get started", { exact: true })).toBeVisible();
  await expect(p.getByText("net kcal of")).toHaveCount(0);
  expect(w.errs).toEqual([]);
});
