// tests/ui/phone-weight-popups.spec.mjs — the Weight tab on a phone (Fix 54), at 390 x 844: a row
// of three pills (Weight Log, Sync Renpho, Plan) with the Trajectory underneath; the log and the
// plan open as pop-ups on a tap; the Trajectory fills the screen on a double tap and closes on
// another double tap, a single tap on a reading shows its value, and the metrics are a drop-down
// under the Trajectory heading.
import { test, expect } from "./cover.mjs";

const WEIGHT = [
  { id: "2026-08-17", week: 0, dose: "2.5mg", actual: 84.2, renpho: { bmi: 31, bodyfat: 30 } },
  { id: "2026-09-10", actual: 82.1, renpho: { bmi: 30, bodyfat: 28 } },
  { id: "2026-10-03", actual: 79.6, renpho: { bmi: 29, bodyfat: 26 } },
];
test.use({ timezoneId: "Europe/London" }); // 390 x 844 comes from the phone project

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((w) => {
    const profile = { firstName: "Jane", lastName: "Smith", email: "j@example.com" };
    Object.assign(window, {
      __authUser: { uid: "u", email: "j@example.com" },
      __docs: { "users/u": profile },
      __days: [{ date: "2026-10-04", notes: "", meals: [] }],
      __collections: { "users/u/weight_log": w },
    });
  }, WEIGHT);
  await p.goto("/app.html");
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByText("net kcal of")).toBeVisible({ timeout: 10000 });
  await p.locator("nav").getByRole("button", { name: "Weight", exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const pill = (p, name) => p.getByRole("button", { name, exact: true });
const popup = (p) => p.getByRole("dialog");
const chartBox = (p) => p.getByTitle("Double-click to expand");

test("three pills in a row; the log and plan are hidden; the Trajectory is underneath", async ({
  page: p,
}) => {
  await start(p);
  const [log, sync, plan] = await Promise.all([
    box(pill(p, "⚖️ Weight Log")),
    box(pill(p, "⟳ Sync Renpho")),
    box(pill(p, "📋 Plan")),
  ]);
  expect(Math.abs(log.top - sync.top)).toBeLessThan(6);
  expect(Math.abs(plan.top - sync.top)).toBeLessThan(6);
  expect(sync.left).toBeGreaterThan(log.right - 1); // Sync to the right of the log pill
  expect(plan.left).toBeGreaterThan(sync.right - 1); // Plan to the right of Sync
  expect(plan.right).toBeLessThanOrEqual(390);
  await expect(p.locator("table")).toHaveCount(0);
  await expect(p.getByText("Plan Specifications")).toHaveCount(0);
  const chart = await box(p.getByText("📉 Trajectory"));
  expect(chart.top).toBeGreaterThan(log.bottom);
});

test("the Weight Log pill opens the log in a pop-up; Close and the backdrop shut it", async ({
  page: p,
}) => {
  await start(p);
  await pill(p, "⚖️ Weight Log").click();
  await expect(popup(p).locator("table")).toBeVisible();
  const frame = popup(p).locator("table").locator("..");
  expect((await box(frame)).right).toBeLessThanOrEqual(390);
  await popup(p).getByRole("button", { name: "Close" }).click();
  await expect(popup(p)).toHaveCount(0);
  await pill(p, "⚖️ Weight Log").click();
  await p.mouse.click(5, 5); // the backdrop
  await expect(popup(p)).toHaveCount(0);
});

test("the Plan pill opens the specifications; closing while editing drops the edits", async ({
  page: p,
}) => {
  await start(p);
  await pill(p, "📋 Plan").click();
  await expect(popup(p).getByText("Plan Specifications")).toBeVisible();
  await expect(popup(p).getByText("Milestone Roadmap")).toBeVisible();
  await popup(p).getByRole("button", { name: "✏ Edit" }).click();
  await expect(popup(p).getByRole("button", { name: "💾 Save Plan" })).toBeVisible();
  await popup(p).getByRole("button", { name: "Close" }).click();
  await pill(p, "📋 Plan").click();
  await expect(popup(p).getByRole("button", { name: "✏ Edit" })).toBeVisible();
});

const heading = (p) => p.getByRole("button", { name: /Trajectory/ });

test("Trajectory: double tap fills the screen; a single tap does not close it; a double tap does", async ({
  page: p,
}) => {
  await start(p);
  expect((await box(chartBox(p))).height).toBeLessThan(844);
  await chartBox(p).dblclick();
  const full = p.getByTitle("Double-tap to close");
  await expect(full).toBeVisible();
  expect((await box(full)).height).toBe(844);
  await full.click({ position: { x: 200, y: 600 } }); // one tap on empty chart
  await expect(full).toBeVisible();
  await full.dblclick({ position: { x: 200, y: 600 } });
  await expect(full).toHaveCount(0);
  await expect(chartBox(p)).toBeVisible();
});

test("a single tap on a reading shows its value in the full-screen chart", async ({ page: p }) => {
  await start(p);
  await chartBox(p).dblclick();
  const svg = p.getByTitle("Double-tap to close").locator("svg:has(circle[fill='transparent'])");
  await expect(svg.locator("rect[rx='4']")).toHaveCount(0);
  await svg.locator('circle[fill="transparent"]').nth(1).click();
  await expect(svg.locator("rect[rx='4']")).toHaveCount(1);
  await expect(p.getByTitle("Double-tap to close")).toBeVisible(); // still open
});

test("the metrics are a drop-down under the Trajectory heading", async ({ page: p }) => {
  await start(p);
  await expect(pill(p, "BMI")).toHaveCount(0); // no row of metric pills
  await expect(heading(p)).toContainText("Weight");
  expect((await box(heading(p))).height).toBeLessThan(50);
  await heading(p).click();
  await expect(pill(p, "BMI")).toBeVisible();
  await expect(pill(p, "Body fat")).toBeVisible();
  await pill(p, "Body fat").click();
  await expect(pill(p, "BMI")).toHaveCount(0); // the list closes on a pick
  await expect(heading(p)).toContainText("Body fat");
  await chartBox(p).dblclick(); // full screen keeps the drop-down
  await expect(heading(p)).toContainText("Body fat");
  await heading(p).click();
  await pill(p, "BMI").click();
  await expect(heading(p)).toContainText("BMI");
});
