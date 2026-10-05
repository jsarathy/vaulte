// tests/ui/polar-detail.spec.mjs — the Daily log's Polar session box (Fix 26 PR 27): opening a
// logged Polar workout (loading mark, missing / failed session), the header, stats, closing,
// fetching heart rate afterwards, and the heart-rate chart, pinned in
// tests/ui/fixtures/polar-detail.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test polar-detail
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/polar-detail.json", import.meta.url);
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
const P = (x) => `users/u/${x}`;

const item = (id, name, extra = {}) => ({ id, name, kcal: -400, is_exercise: 1, ...extra });
const DAY = {
  date: "2026-10-04",
  notes: "",
  meals: [
    {
      id: "mEx",
      name: "Evening Exercise",
      items: [
        item("i1", "Indoor Cycling (46 min) · Polar", { polar_session_id: "s1" }),
        item("i2", "Run · Polar", { polar_session_id: "s2" }),
        item("i3", "Gone · Polar", { polar_session_id: "missing" }),
        item("i4", "Walk (manual)"),
        item("i5", "Shake · Polar", { is_exercise: 0, polar_session_id: "s1" }),
      ],
    },
  ],
};
// A session without heart-rate samples (fetchable), and one with them
const S1 = {
  id: "s1",
  sport: "INDOOR_CYCLING",
  start_time: "2026-10-04T07:30:00",
  duration_min: 45.6,
  calories: 400,
  hr_avg: 131,
  hr_max: 168,
  fat_pct: 35,
  device: "Polar H10",
  exercise_url: "https://polar/ex/1",
};
const samples = (n) =>
  Array.from({ length: n }, (_, i) =>
    i % 17 === 5 ? null : 95 + Math.round(70 * Math.sin(i / 40) ** 2),
  );
const S2 = {
  id: "s2",
  sport: "RUNNING",
  start_time: "2026-10-03T18:05:00",
  duration_min: 30,
  calories: 310,
  hr_samples: samples(700),
  recording_rate_s: 3,
};

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  const docs = { [P("polar_sessions/s1")]: S1, [P("polar_sessions/s2")]: S2 };
  await p.addInitScript(() => localStorage.removeItem("vaulte_collapsed_meals")); // all collapsed
  await p.addInitScript((i) => Object.assign(window, i), { __days: [DAY], __docs: docs, ...init });
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByText("Evening Exercise", { exact: true }).click(); // cards start collapsed
};
const watch = (p) => {
  const out = { errs: [], logged: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  return out;
};
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const link = (p, name) => p.locator("span").filter({ hasText: new RegExp(`^${escape(name)}$`) });
const box = (p) => p.locator('div[style*="z-index: 3000"]');
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
    const attrs = ["viewBox", "points", "x", "y", "x1", "x2", "y1", "y2", "stroke", "stroke-width"]
      .concat(["stroke-dasharray", "fill", "font-size", "font-family", "text-anchor", "disabled"])
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`);
    return [el.tagName, style, ...attrs, ...(own.trim() ? [`"${own}"`] : [])].join(" | ");
  });
const shape = (p) => box(p).evaluate(describe);

test("opening a session: loading mark, header, stats, closing", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { __getDocDelays: { [P("polar_sessions/s1")]: 1000 } });
  // a manual workout isn't a link
  await expect(link(p, "Walk (manual)")).toHaveCount(0);
  await expect(link(p, "Shake · Polar")).toHaveCount(0); // nor is a session id on a non-workout
  await expect(p.getByText("Shake · Polar")).toBeVisible();
  await link(p, "Indoor Cycling (46 min) · Polar").click();
  await expect(link(p, "…")).toBeVisible(); // while the session loads
  await expect(box(p)).toBeVisible();
  await expect(link(p, "Indoor Cycling (46 min) · Polar")).toBeVisible();
  await expect(box(p).locator("div").nth(1)).toHaveText(
    "Indoor CyclingSunday 4 October 2026 · 07:30×",
  );
  const stats = await box(p)
    .locator('div[style*="grid-template-columns: 1fr 1fr"] > div')
    .evaluateAll((ds) => ds.map((d) => [...d.children].map((c) => c.textContent)));
  expect(stats).toEqual([
    ["Duration", "46 min"],
    ["Calories", "400 kcal"],
    ["Avg HR", "131 bpm"],
    ["Max HR", "168 bpm"],
    ["Fat burn %", "35%"],
    ["Fat burned", "16g · 140 kcal"],
    ["Device", "Polar H10"],
  ]);
  await expect(box(p).getByText("Heart rate data wasn't captured at sync time.")).toBeVisible();
  matchGolden("no-hr", await shape(p));
  expect(await p.evaluate(() => window.__getDocPaths.includes("users/u/polar_sessions/s1"))).toBe(
    true,
  );

  // clicking inside doesn't close; the backdrop and × do
  await box(p).getByText("Calories").click();
  await expect(box(p)).toBeVisible();
  await box(p).click({ position: { x: 5, y: 5 } });
  await expect(box(p)).toHaveCount(0);
  await link(p, "Indoor Cycling (46 min) · Polar").click();
  await box(p).getByRole("button", { name: "×" }).click();
  await expect(box(p)).toHaveCount(0);
  expect(w.errs).toEqual([]);
});

test("a session with heart rate; sparse sessions; missing / failed loads", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  await link(p, "Run · Polar").click();
  await expect(box(p).locator("svg")).toHaveCount(1);
  await expect(box(p).getByText("Fetch HR data")).toHaveCount(0);
  matchGolden("with-hr", await shape(p));
  await box(p).getByRole("button", { name: "×" }).click();

  // not found: nothing opens
  await link(p, "Gone · Polar").click();
  await expect(link(p, "Gone · Polar")).toBeVisible();
  await p.waitForTimeout(300);
  await expect(box(p)).toHaveCount(0);

  // only the essentials, no way to fetch heart rate, sport and start unknown
  const bare = { id: "s1", calories: 0, duration_min: null, hr_samples: [120] };
  await start(p, { __docs: { [P("polar_sessions/s1")]: bare } });
  await link(p, "Indoor Cycling (46 min) · Polar").click();
  await expect(box(p).locator("div").nth(1)).toHaveText("Exercise×");
  await expect(box(p).getByRole("button", { name: "Fetch HR data" })).toHaveCount(0);
  matchGolden("bare", await shape(p));
  await box(p).getByRole("button", { name: "×" }).click();

  // every underscore becomes a space; a 0% fat burn still shows (as 0g · 0 kcal)
  const zeroFat = { id: "s1", sport: "OTHER_INDOOR_RUN", calories: 200, fat_pct: 0 };
  await start(p, { __docs: { [P("polar_sessions/s1")]: zeroFat } });
  await link(p, "Indoor Cycling (46 min) · Polar").click();
  await expect(box(p).locator("div").nth(1)).toHaveText("Other Indoor Run×");
  await expect(box(p).getByText("0%", { exact: true })).toBeVisible();
  await expect(box(p).getByText("0g · 0 kcal", { exact: true })).toBeVisible();
  await box(p).getByRole("button", { name: "×" }).click();

  // a failed load is logged; nothing opens
  await p.evaluate(() => (window.__failPaths = ["users/u/polar_sessions/s2"]));
  await link(p, "Run · Polar").click();
  await expect
    .poll(() => w.logged.some((l) => l.startsWith("Failed to load polar session:")))
    .toBe(true);
  await expect(box(p)).toHaveCount(0);
  await expect(link(p, "Run · Polar")).toBeVisible();
  expect(w.errs).toEqual([]);
});

test("heart-rate chart: zones, average, gaps and defaults", async ({ page: p }) => {
  const w = watch(p);
  const hr = (list, extra = {}) => ({ ...S2, hr_samples: list, ...extra });
  const cases = {
    // every zone (max 200), an average line, a gap
    zones: hr([110, 125, 135, 150, 165, 185, null, 199, 100], { hr_max: 200, hr_avg: 150 }),
    // default max 185 and rate 5; two readings only
    defaults: hr([180, 170], { recording_rate_s: undefined }),
    // flat
    flat: hr([120, 120, 120]),
  };
  for (const [name, session] of Object.entries(cases)) {
    await start(p, { __docs: { [P("polar_sessions/s2")]: session } });
    await link(p, "Run · Polar").click();
    await expect(box(p).locator("svg")).toHaveCount(1);
    matchGolden(`chart-${name}`, await shape(p));
  }
  // two or more readings but under two real ones: no chart and no note either (sic)
  for (const list of [
    [120, null],
    [null, null, null],
  ]) {
    await start(p, { __docs: { [P("polar_sessions/s2")]: hr(list, { exercise_url: "x" }) } });
    await link(p, "Run · Polar").click();
    await expect(box(p).getByText("Duration")).toBeVisible();
    await expect(box(p).locator("svg")).toHaveCount(0);
    await expect(box(p).getByRole("button", { name: "Fetch HR data" })).toHaveCount(0);
    await expect(box(p).getByText("Heart rate data wasn't captured at sync time.")).toHaveCount(0);
  }
  // one reading: the note and the fetch button
  await start(p, { __docs: { [P("polar_sessions/s2")]: hr([120], { exercise_url: "x" }) } });
  await link(p, "Run · Polar").click();
  await expect(box(p).getByRole("button", { name: "Fetch HR data" })).toBeVisible();
  expect(w.errs).toEqual([]);
});

test("fetching heart rate after the sync", async ({ page: p }) => {
  const w = watch(p);
  const requests = [];
  let reply = { status: 500, json: { message: "Polar says no" } };
  await start(p, {
    __docs: { [P("polar_sessions/s1")]: { ...S1, exercise_url: undefined, polar_user_id: 9 } },
  });
  await p.route("**/api/polar-fetch-hr", async (r) => {
    requests.push({ body: JSON.parse(r.request().postData()), headers: r.request().headers() });
    await new Promise((res) => setTimeout(res, 1000));
    if (reply === "network") return r.abort();
    r.fulfill({ status: reply.status, json: reply.json });
  });
  await link(p, "Indoor Cycling (46 min) · Polar").click();
  const fetchBtn = box(p).getByRole("button", { name: /Fetch HR data|Fetching…/ });
  const error = (t) => box(p).getByText(t, { exact: true });

  await fetchBtn.click();
  await expect(fetchBtn).toHaveText("Fetching…");
  await expect(fetchBtn).toBeDisabled();
  matchGolden("fetching", await shape(p));
  await expect(error("Polar says no")).toBeVisible();
  await expect(fetchBtn).toBeEnabled();
  expect(requests[0].body).toEqual({ userId: "u", sessionId: "s1" });
  expect(requests[0].headers["content-type"]).toBe("application/json");
  matchGolden("fetch-error", await shape(p));

  reply = { status: 404, json: { error: "No samples" } };
  await fetchBtn.click();
  await expect(fetchBtn).toHaveText("Fetching…");
  expect(await error("Polar says no").count()).toBe(0); // cleared while fetching
  await expect(error("No samples")).toBeVisible();
  reply = { status: 400, json: {} };
  await fetchBtn.click();
  await expect(error("Failed to fetch HR data.")).toBeVisible();
  reply = "network";
  await fetchBtn.click();
  await expect(error("Network error — try again.")).toBeVisible();

  // success: the chart replaces the note
  reply = { status: 200, json: { hr_samples: samples(300), recording_rate_s: 4 } };
  await fetchBtn.click();
  await expect(box(p).locator("svg")).toHaveCount(1);
  await expect(box(p).getByText("Heart rate data wasn't captured at sync time.")).toHaveCount(0);
  matchGolden("fetched", await shape(p));
  // the fetched samples last until the box is closed
  await box(p).getByRole("button", { name: "×" }).click();
  await link(p, "Indoor Cycling (46 min) · Polar").click();
  await expect(fetchBtn).toBeVisible();
  expect(requests.length).toBe(5);
  expect(w.errs).toEqual([]);
});
