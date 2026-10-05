// tests/ui/weight-plan-view.spec.mjs — the Weight tab's Plan Specifications card when not editing
// (Fix 26 PR 23): heading buttons (Edit, Cancel, Save Plan), Personal Stats, Projection Curve and
// the Milestone Roadmap, pinned in tests/ui/fixtures/weight-plan-view.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test weight-plan-view
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/weight-plan-view.json", import.meta.url);
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

const start = async (p, plan) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  const init = { __docs: plan ? { [P("weight_plan/settings")]: plan } : {} }; // init scripts pile up
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Weight", exact: true }).click();
};
const errors = (p) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

const card = (p) => p.getByText("📋 Plan Specifications").locator("xpath=../..");
// Every element of the card: tag, inline style (normalised across Chromium versions), own text
const shape = (p) =>
  card(p).evaluate((root) =>
    [root, ...root.querySelectorAll("*")].map((el) => {
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.nodeValue)
        .join("");
      const style = (el.getAttribute("style") ?? "").replace(
        "border-width: medium; border-style: none; border-color: currentcolor; border-image: none;",
        "border: none;",
      );
      const parts = [el.tagName, style];
      if (own.trim()) parts.push(`"${own}"`);
      if (el.tagName === "INPUT" || el.tagName === "SELECT")
        parts.push(
          `type=${el.getAttribute("type")}`,
          `step=${el.getAttribute("step")}`,
          `value=${el.value}`,
        );
      return parts.join(" | ");
    }),
  );
// Label → value pairs of a section's two-column list
const pairs = (p, title) =>
  card(p)
    .getByText(title)
    .locator("xpath=following-sibling::div[1]/div")
    .evaluateAll((rows) => rows.map((r) => [...r.children].map((c) => c.textContent)));
const milestones = (p) => pairs(p, "🏁 Milestone Roadmap");

test("default plan: stats, curve and milestones", async ({ page: p }) => {
  const errs = errors(p);
  await start(p);
  expect(await pairs(p, "👤 Personal Stats")).toEqual([
    ["Age", "60 yr"],
    ["Sex", "Male"],
    ["Height", "165 cm"],
    ["Start Weight", "83.8 kg"],
    ["Start BMI", "30.8"],
    ["Target", "70–72 kg"],
    ["Target BMI", "25.7–26.4"],
    ["VO₂ Max", "33 — Fair"],
    ["Cum-loss base", "86.45 kg"],
  ]);
  expect(await pairs(p, "📈 Projection Curve")).toEqual([
    ["Anchors", "11 points"],
    ["Plan length", "40 weeks"],
    ["End weight", "65.0 kg"],
    ["Maintenance", "2,136 kcal"],
    ["Sync From", "2026-08-16"],
  ]);
  expect(await milestones(p)).toEqual([
    ["16 Aug 2026", "83.8 kg", "START", "P1"],
    ["06 Sept 2026", "79.7 kg", "-4 kg", "P1"],
    ["04 Oct 2026", "75.5 kg", "-8 kg", "P1"],
    ["08 Nov 2026", "71.7 kg", "TARGET ZONE", "P3"],
    ["23 May 2027", "65.0 kg", "Plan end, wk 40", "P3"],
  ]);
  matchGolden("default", await shape(p));
  expect(errs).toEqual([]);
});

test("another plan: female, VO₂ bands, no curve", async ({ page: p }) => {
  const errs = errors(p);
  const plan = {
    sex: "f",
    age: 41,
    heightCm: 170,
    startWeightKg: 70,
    targetWeightMinKg: 60,
    targetWeightMaxKg: 62.5,
    vo2max: 35,
    cumLossBaselineKg: "72.125",
    maintenanceCaloriesKcal: 1850.5,
    syncFromDate: "2026-09-01",
    planAnchors: [],
  };
  await start(p, plan);
  expect(await pairs(p, "👤 Personal Stats")).toEqual([
    ["Age", "41 yr"],
    ["Sex", "Female"],
    ["Height", "170 cm"],
    ["Start Weight", "70.0 kg"],
    ["Start BMI", "24.2"],
    ["Target", "60–62.5 kg"],
    ["Target BMI", "20.8–21.6"],
    ["VO₂ Max", "35 — Good"],
    ["Cum-loss base", "72.13 kg"],
  ]);
  expect(await pairs(p, "📈 Projection Curve")).toEqual([
    ["Anchors", "1 points"],
    ["Plan length", "—"],
    ["End weight", "—"],
    ["Maintenance", "1,850.5 kcal"],
    ["Sync From", "2026-09-01"],
  ]);
  expect(await milestones(p)).toEqual([]);
  matchGolden("no-curve", await shape(p));

  const vo2 = async (v, want) => {
    await start(p, { ...plan, vo2max: v });
    await expect(card(p).getByText(want, { exact: true })).toBeVisible();
  };
  await vo2(34.9, "34.9 — Fair");
  await vo2(44.9, "44.9 — Good");
  await vo2(45, "45 — Excellent");
  // anchors missing altogether; no maintenance, sync-from or start date
  await start(p, { ...plan, planAnchors: null, maintenanceCaloriesKcal: 0, startDate: "" });
  expect(await pairs(p, "📈 Projection Curve")).toEqual([
    ["Anchors", "1 points"],
    ["Plan length", "—"],
    ["End weight", "—"],
    ["Maintenance", "0 kcal"],
    ["Sync From", "2026-09-01"],
  ]);
  await start(p, { ...plan, syncFromDate: "", startDate: "", maintenanceCaloriesKcal: null });
  expect((await pairs(p, "📈 Projection Curve")).slice(3)).toEqual([
    ["Maintenance", "0 kcal"],
    ["Sync From", "—"],
  ]);
  // a curve that only reaches the target at its end: no TARGET ZONE milestone
  await start(p, {
    ...plan,
    startDate: "2026-08-16",
    planAnchors: [{ week: 6, weightKg: 62 }],
  });
  expect(await milestones(p)).toEqual([
    ["16 Aug 2026", "70.0 kg", "START", "P1"],
    ["06 Sept 2026", "66.0 kg", "-4 kg", "P1"],
    ["27 Sept 2026", "62.0 kg", "-8 kg", "P1"],
    ["27 Sept 2026", "62.0 kg", "Plan end, wk 6", "P3"],
  ]);
  matchGolden("short-curve", await shape(p));
  expect(errs).toEqual([]);
});

test("Edit, Cancel and Save Plan", async ({ page: p }) => {
  const errs = errors(p);
  await start(p);
  const btn = (name) => card(p).getByRole("button", { name, exact: true });
  await expect(btn("✏ Edit")).toBeVisible();
  await expect(btn("Cancel")).toHaveCount(0);
  await btn("✏ Edit").click();
  await expect(btn("✏ Edit")).toHaveCount(0);
  matchGolden("editing-heading", (await shape(p)).slice(0, 6));
  // Cancel throws the edits away: editing again starts from the saved plan
  await card(p).locator('input[type="number"]').first().fill("61");
  await btn("Cancel").click();
  await expect(card(p).getByText("60 yr", { exact: true })).toBeVisible();
  await btn("✏ Edit").click();
  await expect(card(p).locator('input[type="number"]').first()).toHaveValue("60");
  // Save Plan saves what's in the form and shows it
  await card(p).locator('input[type="number"]').first().fill("62");
  await btn("💾 Save Plan").click();
  await expect(card(p).getByText("62 yr", { exact: true })).toBeVisible();
  await expect(btn("✏ Edit")).toBeVisible();
  const saved = await p.evaluate(() =>
    window.__setDocs.filter((s) => s.path === "users/u/weight_plan/settings").map((s) => s.data),
  );
  expect(saved.length).toBe(1);
  expect(saved[0]).toMatchObject({ age: 62, vo2max: 33 });
  expect(errs).toEqual([]);
});
