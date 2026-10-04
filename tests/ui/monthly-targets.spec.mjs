// tests/ui/monthly-targets.spec.mjs — Monthly targets form (Fix 14), pinned before the Fix 26 refactor.
import { test, expect } from "@playwright/test";

const OCT = "users/u/monthly_targets/2026-10";
const NOV = "users/u/monthly_targets/2026-11";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await page.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.addInitScript((oct) => {
    window.__docs = {
      [oct]: { weightKg: 80.5, waistCm: 101, gym: 12, golf: null, sleepHrs: 7.25 },
    };
  }, OCT);
  await page.goto("/tracker.html");
  await page.getByText("Targets · Oct 2026").waitFor();
});

const field = (page, label) =>
  page.locator("div", { hasText: label }).locator("xpath=following-sibling::input").first();
const savesTo = (page, path) =>
  page.evaluate((p) => window.__setDocs.filter((s) => s.path === p).map((s) => s.data), path);

test("loads the month's saved targets", async ({ page }) => {
  await expect(field(page, "Weight (kg)")).toHaveValue("80.5");
  await expect(field(page, "Waist (cm)")).toHaveValue("101");
  await expect(field(page, "Gym sessions")).toHaveValue("12");
  await expect(field(page, "Golf sessions")).toHaveValue("");
  await expect(field(page, "Sleep (avg) (hrs)")).toHaveValue("7.25");
  await expect(page.getByText("± 0.2 kg")).toBeVisible();
});

test("an edit auto-saves the whole month with tolerances; blanks save as null", async ({
  page,
}) => {
  await field(page, "Weight (kg)").fill("79.8");
  await expect(page.getByText("saving…")).toBeVisible();
  await expect(page.getByText("saved", { exact: true })).toBeVisible();
  const saves = await savesTo(page, OCT);
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({
    month: "2026-10",
    weightKg: 79.8,
    waistCm: 101,
    gym: 12,
    golf: null,
    sleepHrs: 7.25,
    tolerance: { weightKg: 0.2, waistCm: 1 },
  });
  expect(saves[0].updated_at).toBeTruthy();
});

test("quick successive edits are saved once", async ({ page }) => {
  await field(page, "Gym sessions").fill("13");
  await field(page, "Golf sessions").fill("4");
  await expect(page.getByText("saved", { exact: true })).toBeVisible();
  const saves = await savesTo(page, OCT);
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({ gym: 13, golf: 4 });
});

test("follows the calendar month: next month loads its own (empty) targets", async ({ page }) => {
  await page
    .locator("button", { has: page.locator("svg") })
    .nth(1)
    .click();
  await page.getByText("Targets · Nov 2026").waitFor();
  await expect(field(page, "Weight (kg)")).toHaveValue("");
  await field(page, "Weight (kg)").fill("78");
  await expect(page.getByText("saved", { exact: true })).toBeVisible();
  expect((await savesTo(page, NOV))[0]).toMatchObject({ month: "2026-11", weightKg: 78 });
  expect(await savesTo(page, OCT)).toHaveLength(0);
});

test("a failed save shows 'not saved'", async ({ page }) => {
  await page.evaluate(() => (window.__failSetDoc = true));
  await field(page, "Weight (kg)").fill("70");
  await expect(page.getByText("not saved")).toBeVisible();
});
