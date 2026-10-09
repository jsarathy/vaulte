// tests/ui/tracker-lazy-start.spec.mjs — the first screen does not wait for everything (Fix 43.3):
// it needs the 5 newest days, recipes and the calculator; older days, the weight and body logs,
// chat and Polar load right after, and a skeleton shows meanwhile.
import { test, expect } from "@playwright/test";

const logged = (date) => ({
  date,
  notes: "",
  meals: [{ id: "m" + date, name: "Breakfast", items: [{ id: "i", name: "Egg", kcal: 80 }] }],
});
const empty = (date) => ({
  date,
  notes: "",
  meals: [{ id: "m" + date, name: "Breakfast", items: [] }],
});
// newest first, like the real read: 4 Oct back to 27 Sep, every day logged
const EIGHT = ["10-04", "10-03", "10-02", "10-01", "09-30", "09-29", "09-28", "09-27"].map((d) =>
  logged("2026-" + d),
);
const P = (x) => `users/u/${x}`;

const start = async (p, init) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
};
const stat = (p, name) =>
  p.getByText(name, { exact: true }).locator("..").locator("span").last().textContent();

test("the first screen shows before the slow reads finish; older days join afterwards", async ({
  page: p,
}) => {
  await start(p, { __days: EIGHT, __allDaysDelay: 2500, __polarDelay: 2500 });
  await expect(p.getByText("Loading your log…")).toHaveCount(0, { timeout: 1500 });
  await expect(p.getByText("Streak")).toHaveCount(0); // not shown on 5 days: it needs every day
  await expect.poll(() => stat(p, "Streak"), { timeout: 6000 }).toBe("8 days");
});

test("a skeleton shows while the first screen loads", async ({ page: p }) => {
  await start(p, { __days: EIGHT, __getDocDelays: { [P("settings/calculator")]: 800 } });
  await expect(p.getByTestId("start-skeleton")).toBeVisible();
  await expect(p.getByText("Loading your log…")).toBeVisible();
  await expect(p.getByTestId("start-skeleton")).toHaveCount(0);
});

test("the weight log and Polar sessions load after the first screen", async ({ page: p }) => {
  await start(p, {
    __days: EIGHT,
    __polarDelay: 1500,
    __collections: { [P("weight_log")]: [{ id: "2026-10-01", week: 1, actual: 80.5 }] },
    __polarDocs: [{ id: "s1", sport: "RUNNING", start_time: "2026-10-01T08:00:00" }],
  });
  await expect(p.getByText("Loading your log…")).toHaveCount(0, { timeout: 1000 });
  await p.getByRole("button", { name: "Weight", exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
  await expect(p.locator("tbody tr", { hasText: "2026-10-01" }).first()).toBeVisible({
    timeout: 5000,
  });
});

test("Compare fills up to 5 days once the older days arrive", async ({ page: p }) => {
  const days = [
    ...["10-08", "10-07", "10-06", "10-05", "10-04"].map((d) => empty("2026-" + d)),
    ...["10-03", "10-02", "10-01", "09-30", "09-29"].map((d) => logged("2026-" + d)),
  ];
  await start(p, { __days: days, __allDaysDelay: 1200 });
  await p.getByRole("button", { name: "Compare", exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
  const heads = p.locator('div[style*="repeat(5"] > div > div:first-child > span');
  await expect(heads.first()).toHaveText("— pick —");
  await expect(heads.first()).toHaveText(/3 Oct/, { timeout: 5000 });
  await expect(heads.last()).toHaveText(/29 Sep/);
});

test("failed later reads leave the first screen working", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p, { __days: EIGHT, __failGetDocs: true, __failPaths: [P("weight_plan/settings")] });
  await expect(p.getByText("Loading your log…")).toHaveCount(0, { timeout: 5000 });
  await expect(p.getByText("October 2026")).toBeVisible();
  expect(errs).toEqual([]);
});

test("a day saved while the older days load is kept when they arrive", async ({ page: p }) => {
  await start(p, { __days: EIGHT, __allDaysDelay: 4000 });
  await p.getByRole("button", { name: "Add entry", exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
  await p.locator('input[type="date"]').first().fill("2026-10-05");
  await p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select —" }) })
    .first()
    .selectOption({ index: 1 });
  await p.locator('xpath=//div[div[normalize-space(.)="kcal"]]/input').first().fill("100");
  await p.getByPlaceholder("e.g. Pinto bean stew (1 portion)").fill("Toast");
  await p.getByRole("button", { name: "Add Item" }).click();
  await expect(p.getByText("✅ Item added!")).toBeVisible();
  // 5 Oct (100) and the 6 newest others (80 each): 580 / 7 — shown only once every day is in
  await expect.poll(() => stat(p, "7-day avg"), { timeout: 8000 }).toBe("83 kcal");
});
