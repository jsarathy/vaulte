// tests/ui/phone-body-trajectory.spec.mjs — the Body tab's Trajectory on a phone (Fix 56), at
// 390 x 844: the sites are a drop-down under the Trajectory heading; a double tap fills the
// screen and another closes it; a single tap on a reading shows its value.
import { test, expect } from "@playwright/test";

const BODY = [
  { id: "2026-09-01", waist: 103, hip: 110 },
  { id: "2026-09-20", waist: 101.5, hip: 109 },
  { id: "2026-10-01", waist: 99, hip: 108 },
];
test.use({ timezoneId: "Europe/London" }); // 390 x 844 comes from the phone project

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((b) => {
    const profile = { firstName: "Jane", lastName: "Smith", email: "j@example.com" };
    Object.assign(window, {
      __authUser: { uid: "u", email: "j@example.com" },
      __docs: { "users/u": profile },
      __days: [{ date: "2026-10-04", notes: "", meals: [] }],
      __collections: { "users/u/body_log": b },
    });
  }, BODY);
  await p.goto("/app.html");
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByText("net kcal of")).toBeVisible({ timeout: 10000 });
  await p.locator("nav").getByRole("button", { name: "Body", exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const heading = (p) => p.getByRole("button", { name: /Trajectory/ });
const list = (p) => heading(p).locator("xpath=following-sibling::div");
const chartBox = (p) => p.getByTitle("Double-click to expand");

test("the sites are a drop-down under the Trajectory heading", async ({ page: p }) => {
  await start(p);
  await expect(heading(p)).toContainText("Waist");
  expect((await box(heading(p))).height).toBeLessThan(50); // one line, not a row of pills
  await expect(list(p)).toHaveCount(0);
  await heading(p).click();
  await expect(list(p).getByRole("button")).toHaveCount(12);
  await list(p).getByRole("button", { name: "Hip", exact: true }).click();
  await expect(list(p)).toHaveCount(0); // closes on a pick
  await expect(heading(p)).toContainText("Hip");
});

test("double tap fills the screen, a single tap does not close it, a double tap does", async ({
  page: p,
}) => {
  await start(p);
  await chartBox(p).dblclick();
  const full = p.getByTitle("Double-tap to close");
  await expect(full).toBeVisible();
  expect((await box(full)).height).toBe(844);
  await expect(heading(p)).toContainText("Waist"); // the drop-down is there too
  await full.click({ position: { x: 200, y: 600 } });
  await expect(full).toBeVisible();
  await full.dblclick({ position: { x: 200, y: 600 } });
  await expect(full).toHaveCount(0);
});

test("a single tap on a reading shows its value", async ({ page: p }) => {
  await start(p);
  await chartBox(p).dblclick();
  const svg = p.getByTitle("Double-tap to close").locator("svg:has(circle[fill='transparent'])");
  await expect(svg.locator("rect[rx='4']")).toHaveCount(0);
  await svg.locator('circle[fill="transparent"]').nth(1).click();
  await expect(svg.locator("rect[rx='4']")).toHaveCount(1);
});
