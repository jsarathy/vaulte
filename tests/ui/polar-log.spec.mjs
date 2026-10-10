// tests/ui/polar-log.spec.mjs — the "log a Polar session" box (Fix 26 PR 17): header, stats,
// heart-rate chart and zones, meal slot, and logging the session as an exercise entry.
import { test, expect } from "@playwright/test";

const RIDE = {
  id: "p1",
  sport: "INDOOR_CYCLING",
  start_time: "2026-10-03T08:00:00",
  duration_min: 45.6,
  calories: 400,
  hr_avg: 130,
  hr_max: 160,
  fat_pct: 40,
  recording_rate_s: 30,
  hr_samples: [90, 100, 110, 130, 140, 150, null, 155, 160, 100, 95],
};
const WALK = {
  id: "p4",
  sport: "WALKING",
  start_time: "2026-10-04T18:30:00",
  duration_min: 20,
  calories: 100,
  fat_pct: 0,
  hr_samples: Array(450).fill(100),
};
// zone boundaries (exactly 60/70/80/90 % of max go up a zone) and fractional readings
const EDGES = {
  id: "p5",
  sport: "ROWING",
  start_time: "2026-10-02T07:00:00",
  duration_min: 7,
  calories: 70,
  hr_max: 100,
  recording_rate_s: 60,
  hr_samples: [59.6, 60, 70, 75, 80, 90, 100.4],
};
const PLAIN = { id: "p2", date: "2026-10-09", calories: 150 };
const NODATE = { id: "p3", sport: "RUNNING", duration_min: 30, calories: 300, hr_samples: [100] };

const start = async (p, sessions, days = []) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript(
    ({ ss, days }) => {
      window.__docs = { "users/u/polar/connection": { connected: true } };
      window.__collections = { "users/u/polar_sessions": ss };
      if (days.length) window.__days = days;
    },
    { ss: sessions, days },
  );
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Add entry", exact: true }).click();
};
const row = (p, text) => p.locator("div", { hasText: text }).filter({ hasText: "⏱" }).last();
const box = (p) => p.locator('div[style*="z-index: 3000"] > div');
const stats = (p) =>
  box(p)
    .locator('div[style*="grid-template-columns: 1fr 1fr"] > div')
    .evaluateAll((es) => es.map((e) => [e.children[0].textContent, e.children[1].textContent]));
const slot = (p) => box(p).locator("select");
const css = (loc, k) => loc.evaluate((e, key) => getComputedStyle(e)[key], k);

test("polar log box: header, stats, chart and zones", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p, [RIDE, WALK, PLAIN, NODATE, EDGES]);
  await row(p, "Indoor Cycling").click();
  // each word's first letter capitalised, as in the Polar Sessions list (Fix 29)
  await expect(box(p).getByText("Indoor Cycling", { exact: true })).toBeVisible();
  await expect(box(p).getByText(/^Saturday,? 3 October · 08:00$/)).toBeVisible();
  expect(await stats(p)).toEqual([
    ["Duration", "46 min"],
    ["Calories", "400 kcal"],
    ["Avg HR", "130 bpm"],
    ["Max HR", "160 bpm"],
    ["Fat burn", "40%"],
    ["Fat burned", "18g"],
  ]);
  // Heart rate: minutes recorded, range, scale labels, average line, line points
  await expect(box(p).getByText("Heart rate · 5 min recorded")).toBeVisible();
  await expect(box(p).getByText("90–160 bpm")).toBeVisible();
  const svg = box(p).locator("svg");
  expect(await svg.getAttribute("viewBox")).toBe("0 0 368 80");
  expect(await svg.locator("text").allTextContents()).toEqual(["165 bpm", "85 bpm"]);
  const avg = svg.locator("line");
  expect(await avg.evaluate((l) => ["x1", "y1", "x2", "y2"].map((a) => l.getAttribute(a)))).toEqual(
    ["4", "35.5", "364", "35.5"],
  );
  const points = (await svg.locator("polyline").getAttribute("points")).split(" ");
  expect(points.length).toBe(10); // the gap is skipped
  expect([points[0], points[1], points.at(-1)]).toEqual(["4.0,71.5", "40.0,62.5", "364.0,67.0"]);
  expect(points[5]).toBe("184.0,17.5"); // 150 bpm, 6th sample
  expect(points[6]).toBe("256.0,13.0"); // 155 bpm, 8th sample (after the gap)
  // Zones by % of max HR: bar widths and the legend (empty zones left out)
  const bar = box(p).locator('div[style*="height: 6px"] > div');
  expect(await bar.evaluateAll((es) => es.map((e) => [e.style.flex, e.style.minWidth]))).toEqual([
    ["0.2 1 0%", "1px"],
    ["0.3 1 0%", "1px"],
    ["0 1 0%", "0px"],
    ["0.2 1 0%", "1px"],
    ["0.3 1 0%", "1px"],
  ]);
  const legend = box(p).locator('div[style*="margin-top: 5px"] > div');
  expect(await legend.allTextContents()).toEqual(["Z1 1m", "Z2 2m", "Z4 1m", "Z5 2m"]);
  expect(
    await legend.locator("div").evaluateAll((es) => es.map((e) => e.style.background)),
  ).toEqual(["rgb(181, 212, 244)", "rgb(192, 221, 151)", "rgb(240, 153, 123)", "rgb(226, 75, 74)"]);
  await box(p).getByRole("button", { name: "×" }).click();
  await expect(box(p)).toHaveCount(0);

  // Defaults: 5 s samples, max HR 180, no average line; long recordings thinned to ≤ ~200 points
  await row(p, "Walking").click();
  await expect(box(p).getByText(/^Sunday,? 4 October · 18:30$/)).toBeVisible();
  expect(await stats(p)).toEqual([
    ["Duration", "20 min"],
    ["Calories", "100 kcal"],
    ["Fat burn", "0%"],
    ["Fat burned", "0g"],
  ]);
  await expect(box(p).getByText("Heart rate · 37 min recorded")).toBeVisible();
  await expect(box(p).getByText("100–100 bpm")).toBeVisible();
  expect(await box(p).locator("svg text").allTextContents()).toEqual(["105 bpm", "95 bpm"]);
  await expect(box(p).locator("svg line")).toHaveCount(0);
  expect((await box(p).locator("polyline").getAttribute("points")).split(" ").length).toBe(225);
  expect(await legend.allTextContents()).toEqual(["Z1 38m"]);
  await box(p).getByRole("button", { name: "Cancel" }).click();
  await expect(box(p)).toHaveCount(0);

  // Zone boundaries; fractional readings shown as read, scale labels rounded
  await row(p, "Rowing").click();
  await expect(box(p).getByText("59.6–100.4 bpm")).toBeVisible();
  expect(await box(p).locator("svg text").allTextContents()).toEqual(["105 bpm", "55 bpm"]);
  expect(await legend.allTextContents()).toEqual(["Z1 1m", "Z2 1m", "Z3 2m", "Z4 1m", "Z5 2m"]);
  await box(p).getByRole("button", { name: "Cancel" }).click();

  // No sport, date only, no HR: "Exercise", the date as stored, no chart
  await row(p, "Exercise").click();
  await expect(box(p).getByText("Exercise", { exact: true })).toBeVisible();
  await expect(box(p).getByText("2026-10-09", { exact: true })).toBeVisible();
  expect(await stats(p)).toEqual([
    ["Duration", "0 min"],
    ["Calories", "150 kcal"],
  ]);
  await expect(box(p).getByText(/Heart rate ·/)).toHaveCount(0);
  // backdrop closes; a click inside doesn't
  await box(p).getByText("Calories").click();
  await expect(box(p)).toHaveCount(1);
  await p.mouse.click(5, 5);
  await expect(box(p)).toHaveCount(0);

  // No date at all: no date line; a single sample → no chart
  await row(p, "Running").click();
  await expect(box(p).getByText("Running", { exact: true })).toBeVisible();
  expect(
    await box(p)
      .locator("div", { hasText: /^Running$/ })
      .locator("xpath=following-sibling::div[1]")
      .textContent(),
  ).toBe("");
  await expect(box(p).locator("svg")).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("polar log box: meal slot and logging", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p, [RIDE, PLAIN, NODATE]);
  const ev = (f, a) => p.evaluate(f, a);
  await expect(p.getByText("3 unlogged sessions")).toBeVisible();
  await row(p, "Indoor Cycling").click();
  const logBtn = box(p).getByRole("button", { name: /Log session|Logging…/ });

  // Slots: the stored day's meals (with the default slots filled in)
  const options = () =>
    slot(p)
      .locator("option")
      .evaluateAll((os) => os.map((o) => [o.value, o.text]));
  const opts = await options();
  expect(opts[0]).toEqual(["", "— select slot —"]);
  expect(opts.find(([, t]) => t === "Breakfast")[0]).toBe("m2026-10-03");
  expect(opts.some(([v, t]) => t === "🌙 Dinner" && v && !v.startsWith("__slot__"))).toBe(true);
  expect(await css(slot(p), "borderTopColor")).toBe("rgb(198, 40, 40)");

  // Needs a slot; picking one clears the message
  await logBtn.click();
  await expect(box(p).getByText("Please select a meal slot")).toBeVisible();
  await slot(p).selectOption("m2026-10-03");
  await expect(box(p).getByText("Please select a meal slot")).toHaveCount(0);
  expect(await css(slot(p), "borderTopColor")).toBe("rgb(209, 213, 219)");

  // Failure: message with the reason; the button works again
  await ev(() => {
    window.__failSaveDay = true;
    window.__saveDayDelay = 1200; // long enough to check the busy state on a busy machine
  });
  await logBtn.click();
  await expect(logBtn).toHaveText("Logging…");
  await expect(logBtn).toBeDisabled();
  expect(await css(logBtn, "cursor")).toBe("not-allowed");
  await expect(box(p).getByText("Failed to log session: Mock saveDay failure")).toBeVisible();
  await expect(logBtn).toHaveText("Log session");
  await expect(logBtn).toBeEnabled();

  // Logged: an exercise entry in that meal, the session marked logged, the box closed
  await ev(() => (window.__failSaveDay = false));
  await slot(p).selectOption({ label: "🌙 Dinner" }); // a slot the stored day didn't have
  await logBtn.click();
  await expect(box(p)).toHaveCount(0);
  const day = await ev(() => window.__savedDays.at(-1));
  expect(day.date).toBe("2026-10-03");
  expect(day.notes).toBe("Rest day");
  expect(day.meals.find((m) => m.id === "m2026-10-03").items).toEqual([]);
  const meal = day.meals.find((m) => m.name === "🌙 Dinner");
  expect(meal.items.length).toBe(1);
  const item = meal.items[0];
  expect(item).toEqual({
    id: item.id,
    name: "Indoor Cycling (46 min) · Polar",
    kcal: -400,
    fat: 0,
    sat_fat: 0,
    carbs: 0,
    sugar: 0,
    fibre: 0,
    net_carbs: 0,
    protein: 0,
    is_exercise: 1,
    fat_burned_g: 18,
    fat_burned_kcal: 160,
    polar_session_id: "p1",
  });
  expect(item.id).toBeTruthy();
  const marked = await ev(() =>
    window.__setDocs.filter((s) => s.path === "users/u/polar_sessions/p1").map((s) => s.data),
  );
  expect(marked).toEqual([{ ...RIDE, logged: true }]);
  await expect(p.getByText("2 unlogged sessions")).toBeVisible();

  // The next session opens fresh: Log session enabled, no slot chosen (Fix 29)
  await row(p, "Exercise").click();
  await expect(logBtn).toHaveText("Log session");
  await expect(logBtn).toBeEnabled();
  await expect(slot(p)).toHaveValue("");
  await expect(box(p).getByText("Please select a meal slot")).toHaveCount(0);

  // Closing the box drops its slot and message too
  await logBtn.click();
  await expect(box(p).getByText("Please select a meal slot")).toBeVisible();
  await slot(p).selectOption("__slot__🌙 Dinner");
  await box(p).getByRole("button", { name: "Cancel" }).click();
  await expect(box(p)).toHaveCount(0);
  await row(p, "Exercise").click();
  await expect(slot(p)).toHaveValue("");
  await expect(box(p).getByText("Please select a meal slot")).toHaveCount(0);
  await expect(logBtn).toBeEnabled();
  expect(errs).toEqual([]);
});

test("polar log box: a day not stored yet, and no date", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const logBtn = box(p).getByRole("button", { name: /Log session|Logging…/ });
  const options = () =>
    slot(p)
      .locator("option")
      .evaluateAll((os) => os.map((o) => [o.value, o.text]));

  // Default slots by name, resolved on the new day
  await start(p, [PLAIN]);
  await row(p, "Exercise").click();
  expect((await options())[1]).toEqual(["__slot__☕ Breakfast", "☕ Breakfast"]);
  await slot(p).selectOption("__slot__🌙 Dinner");
  await logBtn.click();
  await expect(box(p)).toHaveCount(0);
  const newDay = await ev(() => window.__savedDays.at(-1));
  expect(newDay.date).toBe("2026-10-09");
  expect(newDay.notes).toBe("");
  expect(newDay.meals.length).toBeGreaterThan(5);
  expect(newDay.meals.find((m) => m.name === "🌙 Dinner").items).toMatchObject([
    { name: "Exercise (0 min) · Polar", kcal: -150, fat_burned_g: 0, fat_burned_kcal: 0 },
  ]);
  await expect(p.getByText(/unlogged session/)).toHaveCount(0);

  // Started on another day: logged to that day
  await start(p, [{ ...WALK, calories: 101, fat_pct: 33 }]);
  await row(p, "Walking").click();
  await slot(p).selectOption({ label: "Breakfast" }); // already holds an entry
  await logBtn.click();
  await expect(box(p)).toHaveCount(0);
  const walked = await ev(() => window.__savedDays.at(-1));
  expect(walked.date).toBe("2026-10-04");
  const items = walked.meals.find((m) => m.name === "Breakfast").items;
  expect(items.map((i) => i.name)).toEqual(["Cycling (30 min)", "Walking (20 min) · Polar"]);
  expect(items[1]).toMatchObject({ fat_burned_g: 4, fat_burned_kcal: 33 });

  // No date: today (UTC)
  await start(p, [NODATE]);
  await row(p, "Running").click();
  await slot(p).selectOption({ index: 1 });
  await logBtn.click();
  await expect(box(p)).toHaveCount(0);
  expect((await ev(() => window.__savedDays.at(-1))).date).toBe(
    await ev(() => new Date().toISOString().split("T")[0]),
  );
  expect(errs).toEqual([]);
});

test("an already-logged session shows where it went, with no slot picker (Fix 51)", async ({
  page: p,
}) => {
  const day = {
    date: "2026-10-03",
    notes: "",
    meals: [
      {
        id: "ex1",
        name: "Exercise",
        is_exercise: true,
        items: [{ id: "i1", name: "Cycle", kcal: -400, polar_session_id: "p1" }],
      },
    ],
  };
  await start(p, [{ ...RIDE, logged: true }], [day]);
  await p.getByRole("button", { name: "Browse all sessions" }).click();
  await p.getByText("logged", { exact: true }).click();
  await expect(box(p).getByText("Already logged")).toBeVisible();
  await expect(box(p).getByText("Logged to Exercise on 2026-10-03")).toBeVisible();
  await expect(slot(p)).toHaveCount(0);
  await expect(box(p).getByRole("button", { name: "Log session" })).toHaveCount(0);
  await box(p).getByRole("button", { name: "Close" }).click();
  await expect(box(p)).toHaveCount(0);
});

test("a session without heart rate can fetch it from the log box, logged or not (Fix 60)", async ({
  page: p,
}) => {
  const requests = [];
  let reply = { status: 404, json: { message: "Polar says no" } };
  await start(p, [{ ...WALK, hr_samples: null, logged: true }]);
  await p.route("**/api/polar-fetch-hr", (r) => {
    requests.push(JSON.parse(r.request().postData()));
    r.fulfill({ status: reply.status, json: reply.json });
  });
  await p.getByRole("button", { name: "Browse all sessions" }).click();
  await p.getByText("logged", { exact: true }).click();
  await expect(box(p).getByText("Already logged")).toBeVisible();
  await expect(box(p).getByText("Heart rate data wasn't captured at sync time.")).toBeVisible();
  const fetchBtn = box(p).getByRole("button", { name: "Fetch HR data" });
  await fetchBtn.click();
  await expect(box(p).getByText("Polar says no")).toBeVisible();
  expect(requests).toEqual([{ userId: "u", sessionId: "p4" }]);
  reply = { status: 200, json: { hr_samples: [90, 100, 110, 120, 130], recording_rate_s: 30 } };
  await fetchBtn.click();
  await expect(box(p).getByText(/^Heart rate · /)).toBeVisible();
  await expect(fetchBtn).toHaveCount(0);
});

test("an unlogged session without heart rate offers the fetch too; none without a start time", async ({
  page: p,
}) => {
  await start(p, [{ ...RIDE, hr_samples: null }, PLAIN]);
  await row(p, "Indoor Cycling").click();
  await expect(box(p).getByRole("button", { name: "Fetch HR data" })).toBeVisible();
  await expect(slot(p)).toBeVisible(); // still logs as before
  await box(p).getByRole("button", { name: "Cancel" }).click();
  await row(p, "Exercise").click(); // PLAIN: a date only, no start time, no Polar ids
  await expect(box(p).getByText("Heart rate data wasn't captured at sync time.")).toBeVisible();
  await expect(box(p).getByRole("button", { name: "Fetch HR data" })).toHaveCount(0);
});
