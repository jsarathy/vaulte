// tests/ui/phone-weight-popups.spec.mjs — the Weight tab on a phone (Fix 54), at 390 x 844: a row
// of three pills (Weight Log, Sync Renpho, Plan) with the Trajectory underneath; the log and the
// plan open as pop-ups on a tap; the Trajectory fills the screen on a double tap and closes on a
// single tap.
import { test, expect } from "@playwright/test";

const WEIGHT = [
  { id: "2026-08-17", week: 0, dose: "2.5mg", actual: 84.2 },
  { id: "2026-10-03", actual: 79.6 },
];
test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/London" });

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

test("Trajectory: double tap fills the screen; one tap closes; a metric tab does not", async ({
  page: p,
}) => {
  await start(p);
  const compact = await box(chartBox(p));
  expect(compact.height).toBeLessThan(844);
  await chartBox(p).dblclick();
  const full = p.getByTitle("Tap to close");
  await expect(full).toBeVisible();
  expect((await box(full)).height).toBe(844);
  await full.getByRole("button").first().click(); // a metric tab: stays open
  await expect(full).toBeVisible();
  await full.click({ position: { x: 200, y: 400 } });
  await expect(full).toHaveCount(0);
  await expect(chartBox(p)).toBeVisible();
});
