// tests/ui/phone-tap-targets.spec.mjs — tap-target rule for the phone (Fix 43.4.5), at 390 x 844:
// every button, select, text box and tappable day on the signed-in screens is at least 40 px tall
// (buttons and days also 40 px wide), and no button's text is under 11 px.
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, timezoneId: "Europe/London" });

const day = (date, n) => ({
  date,
  notes: "",
  meals: [
    {
      id: "b" + date,
      name: "Breakfast",
      items: Array.from({ length: n }, (_, i) => ({ id: "i" + i, name: "Egg " + i, kcal: 80 })),
    },
    { id: "l" + date, name: "Lunch", items: [] },
  ],
});
const DAYS = [day("2026-10-04", 2), day("2026-10-03", 1), day("2026-10-02", 1)];

const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((days) => {
    const profile = { firstName: "Jane", lastName: "Smith", email: "j@example.com" };
    Object.assign(window, {
      __authUser: { uid: "u", email: "j@example.com" },
      __docs: { "users/u": profile, "users/u/polar/connection": { connected: true } },
      __days: days,
      __collections: {
        "users/u/weight_log": [
          { id: "2026-09-10", actual: 82 },
          { id: "2026-10-03", actual: 79.6 },
        ],
        "users/u/body_log": [{ id: "2026-09-20", waist: 101.5 }],
      },
      __polarDocs: [{ id: "a", sport: "RUNNING", start_time: "2026-10-01T08:00:00", calories: 3 }],
    });
  }, DAYS);
  await p.goto("/app.html");
  await p.getByText("Welcome, Jane.").waitFor({ timeout: 15000 });
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await p.getByText("net kcal of").waitFor({ timeout: 10000 });
};

// What is too small on the screen as it is now
const tooSmall = (p) =>
  p.evaluate(() => {
    const bad = [];
    for (const e of document.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      const field = /^(SELECT|TEXTAREA)$/.test(e.tagName) || e.tagName === "INPUT";
      const button = e.tagName === "BUTTON" || (cs.cursor === "pointer" && !field);
      if (!field && !button) continue;
      if (e.tagName === "INPUT" && /^(hidden|checkbox|radio|file|range)$/.test(e.type)) continue;
      if (button && e.parentElement && getComputedStyle(e.parentElement).cursor === "pointer")
        continue; // the parent is the target
      const r = e.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue; // hidden file / date inputs
      const label = (e.textContent || e.value || e.title || "").trim().slice(0, 20);
      const small = r.height < 39.5 || (button && r.width < 39.5);
      const tiny = e.tagName === "BUTTON" && parseFloat(cs.fontSize) < 11 && label;
      if (small || tiny)
        bad.push(`${e.tagName} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad;
  });
const tab = (p, name) =>
  p.locator(".nt-root nav").getByRole("button", { name, exact: true }).click();
const settle = (p) => p.waitForTimeout(400);

test("Daily log, Compare, Add entry and the Days drawer", async ({ page: p }) => {
  await start(p);
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
  await tab(p, "Compare");
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
  await tab(p, "Add entry");
  await p.getByRole("button", { name: /Polar Sessions/ }).click();
  await p.getByRole("button", { name: /Steps by hour/ }).click();
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
  await tab(p, "Daily log");
  await p.getByRole("button", { name: "☰ Days" }).click();
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
});

test("Weight (log and plan pop-ups) and Body", async ({ page: p }) => {
  await start(p);
  await tab(p, "Weight");
  await p.getByRole("button", { name: "⚖️ Weight Log", exact: true }).click();
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
  await p.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await p.getByRole("button", { name: "📋 Plan", exact: true }).click();
  await p.getByRole("dialog").getByRole("button", { name: "✏ Edit" }).click();
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
  await p.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await tab(p, "Body");
  await settle(p);
  expect(await tooSmall(p)).toEqual([]);
});
