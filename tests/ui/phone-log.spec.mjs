// tests/ui/phone-log.spec.mjs — the Daily log on a phone (Fix 43.5), at 390 x 844: nothing past
// the right edge, the calorie bar's pills under the figure, thumb-sized
// arrows, and meal cards as header + stacked entries (name over labelled figures, remove).
import { test, expect } from "./cover.mjs";

const LS = "vaulte_collapsed_meals";
const DAY = {
  date: "2026-10-04",
  notes: "",
  meals: [
    {
      id: "mB",
      name: "☕ Breakfast",
      items: [
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
        { id: "f2", name: "Toast with a really long name that has to wrap onto lines", kcal: 80 },
      ],
    },
    { id: "mL", name: "🥗 Lunch", items: [] },
  ],
};
test.use({ timezoneId: "Europe/London" }); // 390 x 844 comes from the phone project

const start = async (p, open = true) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript(
    ({ d, LS, open }) => {
      if (!sessionStorage.getItem("started")) {
        localStorage.setItem(LS, JSON.stringify({ mB: !open, mL: !open }));
        sessionStorage.setItem("started", "1");
      }
      Object.assign(window, { __days: [d], __docs: {}, __recipes: [] });
    },
    { d: DAY, LS, open },
  );
  await p.goto("/tracker.html");
  await expect(p.getByText("net kcal of")).toBeVisible();
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());

test("nothing sticks out past the right edge except the sideways-scrolling tabs", async ({
  page: p,
}) => {
  await start(p);
  const out = await p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => !e.closest("nav") && e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => e.tagName + " " + (e.textContent || "").slice(0, 30)),
  );
  expect(out).toEqual([]);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("header arrows are thumb-sized; no summary cards; pills drop under the figure", async ({
  page: p,
}) => {
  await start(p);
  const first = await box(p.getByText("Sun, 4 Oct 2026").locator("..").locator("button").first());
  expect(first.width).toBeGreaterThanOrEqual(44);
  expect(first.height).toBeGreaterThanOrEqual(44);
  await expect(p.getByText("Consumed", { exact: true })).toHaveCount(0); // no summary cards
  await expect(p.getByText("Fat burned", { exact: true })).toBeVisible(); // it is a pill now
  const figure = await box(p.getByText("net kcal of"));
  const pill = await box(p.getByText("Protein", { exact: true }).first());
  expect(pill.top).toBeGreaterThan(figure.bottom - 1); // below, not beside
});

test("meal cards: header with kcal; open shows entries as name over labelled figures", async ({
  page: p,
}) => {
  await start(p);
  await expect(p.getByText("330.3", { exact: true })).toBeVisible(); // the card's kcal
  const long = p.getByText("Toast with a really long name that has to wrap onto lines");
  await expect(long).toBeVisible();
  const lines = await long.evaluate((e) => e.getBoundingClientRect().height / 16);
  expect(lines).toBeGreaterThan(1.5); // wrapped, not clipped
  const soup = p.getByText("Soup (1 portion)").locator("../..");
  await expect(soup).toContainText("kcal 250.3");
  await expect(soup).toContainText("Fat 10g");
  await expect(soup).toContainText("Net C 16g");
  await expect(soup).toContainText("Prot 12.5g");
  await expect(p.getByText("No items logged yet")).toBeVisible(); // the empty Lunch card
  const remove = await box(soup.getByRole("button", { name: "Remove" }));
  expect(remove.width).toBeGreaterThanOrEqual(40);
  expect(remove.height).toBeGreaterThanOrEqual(40);
});

test("meal cards open and close from the header; removing an entry asks first", async ({
  page: p,
}) => {
  await start(p, false);
  await expect(p.getByText("Soup (1 portion)")).toHaveCount(0); // closed by default
  await p.getByText("☕ Breakfast").click();
  await expect(p.getByText("Soup (1 portion)")).toBeVisible();
  const asked = [];
  p.on("dialog", (d) => {
    asked.push(d.message());
    d.dismiss();
  });
  await p.getByRole("button", { name: "Remove" }).first().click();
  expect(asked).toEqual(["Remove this item?"]);
  await expect(p.getByText("Soup (1 portion)")).toBeVisible(); // dismissed: kept
  p.removeAllListeners("dialog");
  p.on("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Remove" }).first().click();
  await expect(p.getByText("Soup (1 portion)")).toHaveCount(0);
  await p.getByText("☕ Breakfast").click();
  await expect(p.getByText("Toast with a really long name")).toHaveCount(0);
});
