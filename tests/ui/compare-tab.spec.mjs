// tests/ui/compare-tab.spec.mjs — the Compare tab (Fix 26 PR 40): the five day columns (kcal and
// macro rows, "—" for an empty slot, swapping a day by date via the prompt) and the Reference
// calculator (inputs, BMR by Mifflin-St Jeor for each sex, the activity rows' TDEE and macros).
import { test, expect } from "./cover.mjs";

const P = (x) => `users/u/${x}`;
const item = (name, kcal, m = {}) => ({ id: name, name, kcal, ...m });
const DAYS = [
  {
    date: "2026-10-01",
    notes: "",
    meals: [
      {
        id: "m1",
        name: "Breakfast",
        items: [
          item("Oats", 350, {
            fat: 6.4,
            carbs: 60.2,
            sugar: 1.1,
            fibre: 8.5,
            net_carbs: 51.7,
            protein: 12.3,
          }),
          item("Milk", 120.4, {
            fat: 4.6,
            carbs: 9.3,
            sugar: 9.3,
            fibre: 0,
            net_carbs: 9.3,
            protein: 6.8,
          }),
        ],
      },
      { id: "ex1", name: "Exercise", is_exercise: true, items: [item("Run", -300)] },
    ],
  },
  {
    date: "2026-10-02",
    notes: "",
    meals: [{ id: "m2", name: "Lunch", items: [item("Soup", 210, { protein: 5 })] }],
  },
  { date: "2026-10-03", notes: "", meals: [] },
];
const CALC = {
  [P("settings/calculator")]: {
    sex: "m",
    age: 50,
    height: 180,
    weight: 80,
    protein: 1.2,
    fatPct: 30,
  },
};

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), { __days: DAYS, __docs: CALC, ...init });
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(p.getByText("Compare days")).toBeVisible();
};
const style = (loc, prop) => loc.evaluate((e, k) => getComputedStyle(e)[k], prop);
const cols = (p) => p.locator('div[style*="repeat(5"] > div');
const head = (p, i) => cols(p).nth(i).locator("> div").first();
const bodyText = (p, i) => cols(p).nth(i).locator("> div").nth(1).innerText();
const rows = (p, i) =>
  cols(p)
    .nth(i)
    .locator("> div")
    .nth(1)
    .locator("> div")
    .evaluateAll((es) => es.map((e) => e.innerText.replace(/\n/g, " ")));
const levels = (p) =>
  p.getByText("Reference calculator").locator("..").locator("> div").last().locator("> div");
const field = (p, l) => p.getByText(l, { exact: true }).locator("..").locator("input, select");
const promptWith = (p, answer, log) =>
  p.once("dialog", (d) => {
    log.push([d.type(), d.message(), d.defaultValue()]);
    answer == null ? d.dismiss() : d.accept(answer);
  });

test("day columns: heads, kcal and macro rows, empty slots", async ({ page: p }) => {
  await start(p);
  await expect(p.getByText("Click a date to swap it out")).toBeVisible();
  await expect(cols(p)).toHaveCount(5);
  expect(await style(cols(p).first().locator(".."), "gridTemplateColumns")).toMatch(
    /^(\S+ ){4}\S+$/,
  );
  await expect(head(p, 0)).toHaveText(/^Thu,? 1 Oct$/); // the days with entries, in order
  await expect(head(p, 1)).toHaveText(/^Fri,? 2 Oct$/);
  await expect(head(p, 2)).toHaveText("— pick —");
  expect(await style(head(p, 0), "cursor")).toBe("pointer");
  await expect(head(p, 0).locator("svg path")).toHaveAttribute("d", "M2 3.5l3 3 3-3");
  expect(await rows(p, 0)).toEqual([
    "470.4", // food only: the run's −300 is left out; fmt to 1 dp
    "kcal",
    "Fat 11g",
    "Carbs 69.5g",
    "Net C 61g",
    "Fibre 8.5g",
    "Protein 19.1g",
    "Sugar 10.4g",
  ]);
  expect(await rows(p, 1)).toEqual([
    "210",
    "kcal",
    "Fat 0g",
    "Carbs 0g",
    "Net C 0g",
    "Fibre 0g",
    "Protein 5g",
    "Sugar 0g",
  ]);
  const kcal = cols(p).nth(0).locator("> div").nth(1).locator("> div").first();
  expect(await style(kcal, "fontSize")).toBe("23px");
  expect(await style(kcal, "fontFamily")).toMatch(/Mono|mono/);
  const row = cols(p).nth(0).locator("> div").nth(1).locator("> div").nth(2);
  expect(await style(row, "borderBottomStyle")).toBe("solid"); // 0.5px, rendered as 1px
  expect(await style(row.locator("span").last(), "fontWeight")).toBe("500");
  expect(await bodyText(p, 2)).toBe("—");
  const dash = cols(p).nth(2).locator("> div").nth(1).locator("> div");
  expect(await style(dash, "fontSize")).toBe("18px");
  expect(await style(dash, "textAlign")).toBe("center");
});

test("swapping a day: the prompt, a known day, an unknown day, cancelling", async ({ page: p }) => {
  await start(p);
  const log = [];
  promptWith(p, "2026-10-01", log);
  await head(p, 2).click();
  expect(log).toEqual([["prompt", "Date (YYYY-MM-DD):", "2026-10-04"]]); // today for an empty slot
  await expect(head(p, 2)).toHaveText(/^Thu,? 1 Oct$/);
  expect(await rows(p, 2)).toEqual(await rows(p, 0));

  promptWith(p, "2026-10-03", log); // a day with no entries still has data (no items)
  await head(p, 0).click();
  expect(log[1]).toEqual(["prompt", "Date (YYYY-MM-DD):", "2026-10-01"]); // the slot's own day
  await expect(head(p, 0)).toHaveText(/^Sat,? 3 Oct$/);
  expect(await rows(p, 0)).toEqual([
    "0",
    "kcal",
    "Fat 0g",
    "Carbs 0g",
    "Net C 0g",
    "Fibre 0g",
    "Protein 0g",
    "Sugar 0g",
  ]);

  promptWith(p, "2026-09-30", log); // unknown day: head shows it, body is "—" (old data dropped)
  await head(p, 0).click();
  await expect(head(p, 0)).toHaveText(/^Wed,? 30 Sep/);
  expect(await bodyText(p, 0)).toBe("—");

  promptWith(p, null, log); // cancel: nothing changes
  await head(p, 1).click();
  await expect(head(p, 1)).toHaveText(/^Fri,? 2 Oct$/);
  promptWith(p, "", log); // empty: nothing changes
  await head(p, 1).click();
  await expect(head(p, 1)).toHaveText(/^Fri,? 2 Oct$/);
  expect(await rows(p, 1)).toEqual([
    "210",
    "kcal",
    "Fat 0g",
    "Carbs 0g",
    "Net C 0g",
    "Fibre 0g",
    "Protein 5g",
    "Sugar 0g",
  ]);
  expect(log).toHaveLength(5);

  // a column shows the live day: food added on Add entry appears in it
  await p.getByRole("button", { name: "Add entry", exact: true }).click();
  await p.locator('input[type="date"]').first().fill("2026-10-02");
  await p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select —" }) })
    .first()
    .selectOption({ index: 1 });
  await p.locator('xpath=//div[div[normalize-space(.)="kcal"]]/input').first().fill("90");
  await p.getByPlaceholder("e.g. Pinto bean stew (1 portion)").fill("Toast");
  await p.getByRole("button", { name: "Add Item" }).click();
  await expect(p.getByText("✅ Item added!")).toBeVisible();
  await p.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(head(p, 1)).toHaveText(/^Fri,? 2 Oct$/);
  expect((await rows(p, 1))[0]).toBe("300");
});

test("reference calculator: inputs, BMR for each sex, activity rows", async ({ page: p }) => {
  await start(p);
  const bmr = () => p.getByText("Mifflin-St Jeor").locator("span").textContent();
  // m: 10·80 + 6.25·180 − 5·50 + 5 = 1680
  expect(await bmr()).toBe("1,680");
  await expect(p.getByText("Mifflin-St Jeor")).toHaveText(/^BMR 1,680 kcal · Mifflin-St Jeor$/);
  await expect(levels(p)).toHaveCount(5);
  const level = async (i) => (await levels(p).nth(i).innerText()).split("\n");
  expect(await level(0)).toEqual([
    "Sedentary",
    "2,016",
    "Desk job, little/no exercise",
    "P:96g F:67g C:257g",
  ]);
  expect(await level(4)).toEqual([
    "Extremely Active",
    "3,192",
    "Physical job + hard training",
    "P:96g F:106g C:464g",
  ]);
  expect(await style(levels(p).nth(0), "borderColor")).toBe("rgb(55, 138, 221)");
  expect(await style(levels(p).nth(0), "backgroundColor")).not.toBe("rgb(255, 255, 255)");
  expect(await style(levels(p).nth(1), "backgroundColor")).toBe("rgb(255, 255, 255)");
  expect(await style(levels(p).nth(1), "borderColor")).not.toBe("rgb(55, 138, 221)");
  const first = levels(p).nth(0).locator("span");
  expect(await style(first.nth(0), "color")).toBe("rgb(24, 95, 165)");
  expect(await style(first.nth(1), "color")).toBe("rgb(55, 138, 221)");
  expect(await style(levels(p).nth(1).locator("span").nth(0), "color")).not.toBe(
    "rgb(24, 95, 165)",
  );
  expect(await style(levels(p).nth(0), "backgroundColor")).toBe("rgb(230, 241, 251)");
  expect(await style(levels(p).nth(1).locator("span").nth(1), "color")).not.toBe(
    "rgb(55, 138, 221)",
  );

  await field(p, "Sex").selectOption("f"); // −161 instead of +5
  expect(await bmr()).toBe("1,514");
  await field(p, "Age").fill("30");
  expect(await bmr()).toBe("1,614");
  await field(p, "Height cm").fill("170");
  expect(await bmr()).toBe("1,552"); // 1551.5 rounds up
  await field(p, "Weight kg").fill("60");
  expect(await bmr()).toBe("1,352"); // 600 + 1062.5 − 150 − 161 = 1351.5 → 1,352
  await field(p, "Protein target").selectOption("2.0");
  await field(p, "Fat % of calories").selectOption("40");
  await expect
    .poll(async () => {
      const saves = await p.evaluate(() =>
        window.__setDocs.filter((s) => s.path === "users/u/settings/calculator"),
      );
      const { updated_at: _at, ...d } = saves.at(-1)?.data || {};
      return d;
    })
    .toEqual({ sex: "f", age: 30, height: 170, weight: 60, protein: 2, fatPct: 40 }); // numbers
  expect(await level(0)).toEqual([
    "Sedentary",
    "1,622",
    "Desk job, little/no exercise",
    "P:120g F:72g C:124g",
  ]);
  expect(await style(field(p, "Age"), "height")).toBe("34px");
  expect(await style(p.getByText("Age", { exact: true }), "textTransform")).toBe("uppercase");
  expect(await field(p, "Protein target").locator("option").allTextContents()).toEqual([
    "0.8g/kg standard",
    "1.2g/kg active",
    "1.4g/kg 60+ preserve",
    "1.6g/kg strength",
    "2.0g/kg performance",
  ]);
  expect(await field(p, "Fat % of calories").locator("option").allTextContents()).toEqual([
    "25%",
    "30%",
    "35%",
    "40%",
  ]);
  expect(await style(p.getByText("Reference calculator").locator(".."), "width")).toBe("290px");
});
