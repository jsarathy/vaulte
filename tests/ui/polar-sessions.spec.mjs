// tests/ui/polar-sessions.spec.mjs — the Polar Sessions card on Add Entry (Fix 26 PR 10): not
// connected, unlogged sessions, "all logged" with recent sessions, and Browse all sessions.
import { test, expect } from "@playwright/test";

const CYCLE = {
  id: "p1",
  sport: "INDOOR_CYCLING",
  start_time: "2026-10-03T08:00:00",
  duration_min: 45.6,
  calories: 400,
  hr_avg: 130,
  hr_max: 160,
  fat_pct: 40,
  hr_samples: [1],
  logged: true,
};
const RUN = {
  id: "p2",
  sport: "RUNNING",
  start_time: "2026-10-02T18:30:00",
  duration_min: 30,
  calories: 300,
  logged: true,
};
const OTHER = {
  id: "p3",
  start_time: "2026-09-30T07:15:00",
  duration_min: 20,
  calories: 150,
  fat_pct: 0,
};
const LAST_SYNC = "2026-10-04T09:05:00";

const start = async (p, polar) => {
  await p.addInitScript((pol) => {
    window.__noBackfill = true;
    window.__polar = pol;
  }, polar);
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
};
const logged = (p) => p.evaluate(() => window.__polarLog?.id ?? null);

test("not connected: connect button goes to Polar sign-in", async ({ page: p }) => {
  await p.route("**/api/polar-auth**", (r) => r.fulfill({ body: "auth page" }));
  await start(p, { connected: false });
  await expect(p.getByText("Connect your Polar device")).toBeVisible();
  await p.getByRole("button", { name: "Connect Polar Account" }).click();
  await p.waitForURL("**/api/polar-auth?userId=u");
});

test("unlogged sessions: count, rows, click to log", async ({ page: p }) => {
  await start(p, { connected: true, sessions: [CYCLE, OTHER], lastSync: LAST_SYNC });
  await expect(p.getByText("2 unlogged sessions")).toBeVisible();
  await expect(p.getByText("Synced 4 Oct, 09:05")).toBeVisible();
  const cycle = p.locator("div", { hasText: "Indoor Cycling" }).filter({ hasText: "⏱" }).last();
  await expect(cycle).toHaveText(
    /^Indoor CyclingSat,? 3 Oct 08:00⏱ 46 min🔥 400 kcal❤️ 130 bpm avg↑160 max🧈 40% fat$/,
  );
  const other = p
    .locator("div", { hasText: /^Exercise/ })
    .filter({ hasText: "⏱" })
    .last();
  await expect(other).toHaveText(/^ExerciseWed,? 30 Sept? 07:15⏱ 20 min🔥 150 kcal🧈 0% fat$/);
  await other.click();
  expect(await logged(p)).toBe("p3");
});

test("one unlogged session, no last sync", async ({ page: p }) => {
  await start(p, { connected: true, sessions: [OTHER] });
  await expect(p.getByText("1 unlogged session", { exact: true })).toBeVisible();
  await expect(p.getByText(/^Synced/)).toHaveCount(0);
});

test("all logged: recent sessions loaded on request", async ({ page: p }) => {
  await start(p, { connected: true, sessions: [], lastSync: LAST_SYNC });
  await expect(p.getByText("All sessions logged.")).toBeVisible();
  await expect(p.getByText("Last sync: 4 Oct, 09:05")).toBeVisible();
  await p.evaluate(
    (docs) => Object.assign(window, { __polarDocs: docs, __polarDelay: 300 }),
    [CYCLE, RUN, OTHER],
  );
  await p.getByRole("button", { name: "Load recent sessions ↓" }).click();
  // Nothing in the recent area while loading
  await expect(p.getByRole("button", { name: "Load recent sessions ↓" })).toHaveCount(0, {
    timeout: 100,
  });
  await expect(p.getByText("Recent sessions")).toBeVisible();
  const recent = p.getByText("Recent sessions", { exact: true }).locator("..");
  const rows = recent.locator(":scope > div").filter({ hasText: "kcal" });
  await expect(rows).toHaveText([
    "Indoor Cycling3 Oct46 min400 kcal❤ 130 bpm🧈 18g fatHR ✓",
    "Running2 Oct30 min300 kcal",
  ]); // only logged sessions
  const run = rows.nth(1);
  await run.click();
  expect(await logged(p)).toBe("p2");
});

test("all logged: more than 10 logged → the first 10 shown", async ({ page: p }) => {
  await start(p, { connected: true, sessions: [] });
  const many = Array.from({ length: 12 }, (_, i) => ({
    ...RUN,
    id: `r${i}`,
    start_time: `2026-09-${String(28 - i).padStart(2, "0")}T07:00:00`,
  }));
  await p.evaluate((docs) => (window.__polarDocs = docs), many);
  await p.getByRole("button", { name: "Load recent sessions ↓" }).click();
  const rows = p
    .getByText("Recent sessions", { exact: true })
    .locator("..")
    .locator(":scope > div");
  await expect(rows.filter({ hasText: "kcal" })).toHaveCount(10);
  await expect(rows.nth(1)).toContainText(/28 Sept?/);
  await expect(rows.nth(10)).toContainText(/19 Sept?/);
});

test("all logged: none of the loaded sessions logged → no recent list", async ({ page: p }) => {
  await start(p, { connected: true, sessions: [] });
  await p.evaluate((docs) => (window.__polarDocs = docs), [OTHER]);
  await p.getByRole("button", { name: "Load recent sessions ↓" }).click();
  await expect(p.getByRole("button", { name: "Load recent sessions ↓" })).toHaveCount(0);
  await expect(p.getByText("Recent sessions")).toHaveCount(0);
});

test("browse all sessions: list, filters, footer, log, close", async ({ page: p }) => {
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await start(p, { connected: true, sessions: [] });
  await p.evaluate(
    (docs) => Object.assign(window, { __polarDocs: docs, __polarDelay: 300 }),
    [CYCLE, RUN, OTHER],
  );
  await p.getByRole("button", { name: "Browse all sessions" }).click();
  await expect(p.getByText("All Polar sessions")).toBeVisible();
  await expect(p.getByText("Loading sessions…")).toBeVisible();
  await expect(p.getByText("Click any unlogged session to log it")).toHaveCount(0, {
    timeout: 100,
  }); // no footer while loading
  await expect(p.getByText("3 total · 2 logged · 1 pending")).toBeVisible();
  await expect(p.getByText("Click any unlogged session to log it")).toBeVisible();
  const card = (title) =>
    p
      .locator("div", { has: p.getByText(title, { exact: true }) })
      .filter({
        hasText: "Duration",
      })
      .last();
  await expect(card("Indoor Cycling")).toHaveText(
    /^Indoor CyclingloggedSat,? 3 Oct 2026 · 08:00Duration 46 minCalories 400 kcalAvg HR 130 bpmMax HR 160 bpmFat burned 18gHR data ✓$/,
  );
  await expect(card("Exercise")).toHaveText(
    /^ExerciseWed,? 30 Sept? 2026 · 07:15Duration 20 minCalories 150 kcalFat burned 0g$/,
  );
  await expect(card("Exercise")).toHaveCSS("opacity", "1");
  await expect(card("Running")).toHaveCSS("opacity", "0.7");

  // Filters: activity, date text, ISO date; nothing → message
  const search = p.getByPlaceholder(
    "Filter by date (e.g. 17 Mar, 2026-03) or activity (cycling, running…)",
  );
  await expect(search).toBeFocused();
  const modal = p.getByText("All Polar sessions", { exact: true }).locator("../..");
  const titles = () =>
    modal.locator("span", { hasText: /^(Indoor Cycling|Running|Exercise)$/ }).allTextContents();
  await search.fill("CYCL");
  expect(await titles()).toEqual(["Indoor Cycling"]);
  await search.fill("indoor cycling");
  expect(await titles()).toEqual(["Indoor Cycling"]);
  await search.fill("2 oct");
  expect(await titles()).toEqual(["Running"]);
  await search.fill("2026-09");
  expect(await titles()).toEqual(["Exercise"]);
  await search.fill("swim");
  await expect(p.getByText("No sessions match")).toBeVisible();
  await search.fill("");
  expect(await titles()).toEqual(["Indoor Cycling", "Running", "Exercise"]);

  // Clicking a session closes the list and opens the log box (logged ones too)
  await search.fill("run");
  await card("Running").click();
  await expect(p.getByText("All Polar sessions")).toHaveCount(0);
  expect(await logged(p)).toBe("p2");

  // Reopen: search cleared; × and backdrop close; a failed load is logged, the list kept
  await p.getByRole("button", { name: "Browse all sessions" }).click();
  await expect(search).toHaveValue("");
  await p.getByRole("button", { name: "×" }).first().click();
  await expect(p.getByText("All Polar sessions")).toHaveCount(0);
  await p.getByRole("button", { name: "Browse all sessions" }).click();
  await p.mouse.click(5, 300);
  await expect(p.getByText("All Polar sessions")).toHaveCount(0);
  await p.evaluate(() => (window.__failGetDocs = true));
  await p.getByRole("button", { name: "Browse all sessions" }).click();
  await expect(p.getByText("Loading sessions…")).toHaveCount(0);
  expect(errs.some((e) => e.includes("Mock getDocs failure"))).toBe(true);
  await expect(p.getByText("3 total · 2 logged · 1 pending")).toBeVisible();
});
