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
      [oct]: {
        weightKg: 80.5,
        waistCm: 101,
        gym: 12,
        golf: null,
        sleepHrs: 7.25,
        actuals: { weightKg: 80.6, gym: 5, sleepHrs: 6.5 },
      },
    };
  }, OCT);
  await page.goto("/tracker.html");
  await page.getByText("Targets · Oct 2026").waitFor();
});

const field = (page, label) => page.getByLabel(label, { exact: true });
const savesTo = (page, path) =>
  page.evaluate((p) => window.__setDocs.filter((s) => s.path === p).map((s) => s.data), path);

test("loads the month's saved targets", async ({ page }) => {
  await expect(field(page, "Weight target")).toHaveValue("80.5");
  await expect(field(page, "Waist target")).toHaveValue("101");
  await expect(field(page, "Gym sessions target")).toHaveValue("12");
  await expect(field(page, "Golf sessions target")).toHaveValue("");
  await expect(field(page, "Sleep (avg) target")).toHaveValue("7.25");
  await expect(page.getByText("± 0.2 kg")).toBeVisible();
});

test("an edit auto-saves the whole month with tolerances; blanks save as null", async ({
  page,
}) => {
  await field(page, "Weight target").fill("79.8");
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
    actuals: { weightKg: 80.6, waistCm: null, gym: 5, golf: null, sleepHrs: 6.5 },
  });
  expect(saves[0].updated_at).toBeTruthy();
});

test("quick successive edits are saved once", async ({ page }) => {
  // both edits in one step, well inside the 600 ms wait even on a busy machine
  const inputs = [
    await field(page, "Gym sessions target").elementHandle(),
    await field(page, "Golf sessions target").elementHandle(),
  ];
  await page.evaluate(([gym, golf]) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [el, v] of [
      [gym, "13"],
      [golf, "4"],
    ]) {
      set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, inputs);
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
  await expect(field(page, "Weight target")).toHaveValue("");
  await field(page, "Weight target").fill("78");
  await expect(page.getByText("saved", { exact: true })).toBeVisible();
  expect((await savesTo(page, NOV))[0]).toMatchObject({ month: "2026-11", weightKg: 78 });
  expect(await savesTo(page, OCT)).toHaveLength(0);
});

test("a failed save shows 'not saved'", async ({ page }) => {
  await page.evaluate(() => (window.__failSetDoc = true));
  await field(page, "Weight target").fill("70");
  await expect(page.getByText("not saved")).toBeVisible();
});

test("loads the month's actuals beside the targets", async ({ page }) => {
  await expect(field(page, "Weight actual")).toHaveValue("80.6");
  await expect(field(page, "Waist actual")).toHaveValue("");
  await expect(field(page, "Gym sessions actual")).toHaveValue("5");
  await expect(field(page, "Sleep (avg) actual")).toHaveValue("6.5");
});

test("an actual auto-saves with the month, and the verdict follows the numbers", async ({
  page,
}) => {
  await expect(page.getByText("✓ on target")).toHaveCount(1); // weight 80.6 vs 80.5 ± 0.2
  await expect(page.getByText("off target")).toHaveCount(2); // gym 5 < 12, sleep 6.5 < 7.25
  await field(page, "Gym sessions actual").fill("12");
  await field(page, "Weight actual").fill("81");
  await expect(page.getByText("saved", { exact: true })).toBeVisible();
  const saves = await savesTo(page, OCT);
  expect(saves[saves.length - 1]).toMatchObject({
    weightKg: 80.5,
    actuals: { weightKg: 81, gym: 12, sleepHrs: 6.5 },
  });
  await expect(page.getByText("✓ on target")).toHaveCount(1); // gym now met; weight now outside
  await expect(page.getByText("off target")).toHaveCount(2);
});

test("no verdict until both the target and the actual are filled in", async ({ page }) => {
  await expect(field(page, "Golf sessions actual")).toHaveValue("");
  await field(page, "Golf sessions actual").fill("2");
  await expect(page.getByText("off target")).toHaveCount(2); // golf has no target yet
  await field(page, "Golf sessions target").fill("4");
  await expect(page.getByText("off target")).toHaveCount(3);
});
