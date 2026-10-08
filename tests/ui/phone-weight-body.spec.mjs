// tests/ui/phone-weight-body.spec.mjs — the Weight and Body tabs on a phone (Fix 43.7), at
// 390 x 844 in the signed-in page: the log, chart and plan / measurement boxes stacked in one
// column, nothing past the right edge (the log tables scroll sideways inside their frames),
// and the table frames sized to the visible height (dvh).
import { test, expect } from "@playwright/test";

const WEIGHT = [
  { id: "2026-08-17", week: 0, dose: "2.5mg", actual: 84.2 },
  { id: "2026-09-07", actual: 82.6 },
  { id: "2026-10-03", actual: 79.6 },
];
const BODY = [
  { id: "2026-09-20", waist: 101.5, hip: 108, neck: 41 },
  { id: "2026-10-01", waist: 99, calfL: 39.2 },
];
test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/London" });

const start = async (p, tab) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript(
    ([w, b]) => {
      const profile = { firstName: "Jane", lastName: "Smith", email: "j@example.com" };
      Object.assign(window, {
        __authUser: { uid: "u", email: "j@example.com" },
        __docs: { "users/u": profile },
        __days: [{ date: "2026-10-04", notes: "", meals: [] }],
        __collections: { "users/u/weight_log": w, "users/u/body_log": b },
      });
    },
    [WEIGHT, BODY],
  );
  await p.goto("/app.html");
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByText("net kcal of")).toBeVisible({ timeout: 10000 });
  await p.locator("nav").getByRole("button", { name: tab, exact: true }).click();
};
const box = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const strays = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => !e.closest("nav") && !e.closest("table"))
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => e.tagName + " " + (e.textContent || "").slice(0, 30)),
  );

test("Weight: log, chart and plan stacked; the table scrolls inside its frame", async ({
  page: p,
}) => {
  await start(p, "Weight");
  const log = await box(p.getByText("⚖️ Weight Log"));
  const chart = await box(p.getByText(/Trajectory/).first());
  const plan = await box(p.getByText("Plan Specifications"));
  expect(chart.top).toBeGreaterThan(log.top + 150); // below the log, not beside it
  expect(plan.top).toBeGreaterThan(chart.top + 150);
  expect([log.left, chart.left, plan.left].every((x) => x < 40)).toBe(true);
  expect(await strays(p)).toEqual([]);
  const frame = p.locator("table").first().locator("..");
  expect(await frame.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true); // sideways inside
  expect((await box(frame)).right).toBeLessThanOrEqual(390);
  expect(await frame.evaluate((e) => getComputedStyle(e).maxHeight)).toBe("624px"); // 844 - 220
});

test("Body: log, chart and measurement sites stacked; nothing past the edge", async ({
  page: p,
}) => {
  await start(p, "Body");
  const log = await box(p.getByText("📏 Body Log"));
  const chart = await box(p.getByText(/Trajectory/).first());
  const sites = await box(p.getByText("Measurement Sites"));
  expect(chart.top).toBeGreaterThan(log.top + 100);
  expect(sites.top).toBeGreaterThan(chart.top + 150);
  expect([log.left, chart.left, sites.left].every((x) => x < 40)).toBe(true);
  expect(await strays(p)).toEqual([]);
  const frame = p.locator("table").first().locator("..");
  expect(await frame.evaluate((e) => getComputedStyle(e).maxHeight)).toBe("624px"); // 844 - 220
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
