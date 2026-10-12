// tests/ui/dashboard.spec.mjs — the Dashboard panel (Fix 98): a row per app with when it last gave
// data and a fresh / stale / missing marker, the Claude usage entry, and failed reads. Firebase is
// mocked; "now" is 11 Oct 2026, 12:00.
import { test, expect } from "./cover.mjs";

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date(2026, 9, 11, 12, 0, 0));
  await p.addInitScript((i) => Object.assign(window, i), {
    __authUser: { uid: "u", email: "jane@example.com" },
    ...init,
    __docs: {
      "users/u": { firstName: "Jane", lastName: "Smith" },
      ...(init.__docs || {}),
    },
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.getByRole("button", { name: "Dashboard" }).click();
  await expect(p.getByRole("heading", { name: "Dashboard" })).toBeVisible();
};
const hoursAgo = (h) =>
  new Date(new Date(2026, 9, 11, 12, 0, 0).getTime() - h * 3600000).toISOString();
const app = (p, id) => p.locator(`[data-app="${id}"]`);

test("every app fresh: Polar, Apple Health and the Renpho scale and tape", async ({ page: p }) => {
  await start(p, {
    __docs: { "users/u/polar/connection": { connected: true, last_sync_at: hoursAgo(2) } },
    __collections: {
      "users/u/apple_activity": [
        { id: "2026-10-10", date: "2026-10-10", updated_at: hoursAgo(30) },
        { id: "2026-10-11", date: "2026-10-11", updated_at: hoursAgo(3) },
      ],
      "users/u/weight_log": [
        { id: "2026-10-01", date: "2026-10-01" },
        { id: "2026-10-10", date: "2026-10-10" },
      ],
      "users/u/body_log": [{ id: "2026-10-01", date: "2026-10-01" }],
    },
  });
  await expect(p.getByText("YOUR APPS")).toBeVisible();
  await expect(app(p, "polar")).toContainText("Last sync 2 hours ago"); // the newest record is used
  await expect(app(p, "apple")).toContainText("Last data 3 hours ago");
  await expect(app(p, "weight")).toContainText("Last reading yesterday");
  await expect(app(p, "body")).toContainText("Last reading 10 days ago");
  for (const id of ["polar", "apple", "weight", "body"])
    await expect(app(p, id).getByRole("img", { name: "Up to date" })).toBeVisible();
});

test("stale, not connected and no data are marked", async ({ page: p }) => {
  await start(p, {
    __docs: { "users/u/polar/connection": { connected: false, last_sync_at: hoursAgo(1) } },
    __collections: {
      "users/u/apple_activity": [{ id: "x", date: "2026-10-08", updated_at: hoursAgo(80) }],
      "users/u/weight_log": [],
      "users/u/body_log": [{ id: "2026-08-01", date: "2026-08-01" }],
    },
  });
  await expect(app(p, "polar")).toContainText("Not connected");
  await expect(app(p, "polar").getByRole("img", { name: "No data" })).toBeVisible();
  await expect(app(p, "apple")).toContainText("Last data 3 days ago");
  await expect(app(p, "apple").getByRole("img", { name: "Stale" })).toBeVisible();
  await expect(app(p, "weight")).toContainText("No readings");
  await expect(app(p, "weight").getByRole("img", { name: "No data" })).toBeVisible();
  await expect(app(p, "body")).toContainText("Last reading 71 days ago");
  await expect(app(p, "body").getByRole("img", { name: "Stale" })).toBeVisible();
});

test("a read that fails shows an error row and leaves the others", async ({ page: p }) => {
  await start(p, {
    __failPaths: ["users/u/polar/connection"],
    __collections: {
      "users/u/apple_activity": [{ id: "x", date: "2026-10-11", updated_at: hoursAgo(1) }],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  await expect(app(p, "polar")).toContainText("Could not read");
  await expect(app(p, "polar").getByRole("img", { name: "Error" })).toBeVisible();
  await expect(app(p, "apple")).toContainText("Last data 1 hour ago");
});

test("the Claude entry opens the usage table", async ({ page: p }) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
      "users/u/ai_usage": [
        {
          id: "a",
          feature: "chat",
          at: hoursAgo(2),
          input_tokens: 4000,
          output_tokens: 300,
          cost_usd: 0.0165,
        },
      ],
    },
  });
  await expect(p.getByText("CLAUDE", { exact: true })).toBeVisible();
  await p.getByRole("button", { name: "CLAUDE USAGE" }).dblclick();
  await expect(p.getByRole("dialog", { name: "Claude usage" })).toContainText("1.65¢");
});

test("the Dashboard is a navigation item: other panels leave it and come back", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  await p.getByRole("button", { name: "My Account" }).click();
  await expect(p.getByRole("heading", { name: "My Account" })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
  await p.getByRole("button", { name: "Dashboard" }).click();
  await expect(p.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

const box = (p, title) =>
  p.getByRole("region", { name: title }).evaluate((e) => e.getBoundingClientRect().toJSON());

test("on a monitor: three framed boxes side by side, apps left, Claude in the middle, links right", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  const [apps, claude, infra] = [
    await box(p, "YOUR APPS"),
    await box(p, "CLAUDE"),
    await box(p, "INFRASTRUCTURE"),
  ];
  // in order, on one row, each about a third of the width of the three together
  expect(apps.right).toBeLessThanOrEqual(claude.left);
  expect(claude.right).toBeLessThanOrEqual(infra.left);
  expect(Math.abs(apps.top - claude.top)).toBeLessThan(2);
  expect(Math.abs(claude.top - infra.top)).toBeLessThan(2);
  const total = infra.right - apps.left;
  for (const b of [apps, claude, infra]) {
    expect(b.width).toBeGreaterThan(total * 0.28);
    expect(b.width).toBeLessThan(total * 0.38);
  }
  // framed
  const frame = await p
    .getByRole("region", { name: "CLAUDE" })
    .evaluate((e) => getComputedStyle(e).borderTopWidth + " " + getComputedStyle(e).borderTopStyle);
  expect(frame).toBe("1px solid");
  // the apps are inside the left box, Claude's heading in the middle one
  await expect(p.getByRole("region", { name: "YOUR APPS" }).locator("[data-app]")).toHaveCount(4);
  await expect(
    p.getByRole("region", { name: "CLAUDE" }).getByRole("button", { name: "CLAUDE USAGE" }),
  ).toBeVisible();
});

test("the infrastructure box links to Vercel, Firebase and GitHub, each in a new tab", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  const links = p.getByRole("region", { name: "INFRASTRUCTURE" }).getByRole("link");
  await expect(links).toHaveText([
    "Vercel",
    "Firebase",
    "GitHub",
    "GitHub Actions",
    "GitHub issues",
  ]);
  const hrefs = await links.evaluateAll((as) => as.map((a) => [a.href, a.target, a.rel]));
  expect(hrefs[0]).toEqual([
    "https://vercel.com/jsarathys-projects/vaulte",
    "_blank",
    "noopener noreferrer",
  ]);
  expect(hrefs.every(([href, target]) => href.startsWith("https://") && target === "_blank")).toBe(
    true,
  );
  await expect(p.getByText("Hosting, deployments and function logs")).toBeVisible();
});

test("the Claude box has the usage heading and the Anthropic Console link, which is not under infrastructure", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  const claude = p.getByRole("region", { name: "CLAUDE" });
  const link = claude.getByRole("link", { name: "Anthropic Console" });
  await expect(link).toHaveAttribute("href", "https://console.anthropic.com");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(claude.getByText("Claude API usage and spend limits")).toBeVisible();
  await expect(
    p
      .getByRole("region", { name: "INFRASTRUCTURE" })
      .getByRole("link", { name: "Anthropic Console" }),
  ).toHaveCount(0);
});

test("on a monitor the type is large in every box: titles, names, notes, links, the Claude heading", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  for (const title of ["YOUR APPS", "CLAUDE", "INFRASTRUCTURE"])
    expect(
      await size(p.getByRole("region", { name: title }).getByText(title, { exact: true })),
      title,
    ).toBeGreaterThanOrEqual(16);
  const apps = p.getByRole("region", { name: "YOUR APPS" });
  expect(await size(apps.locator('[data-app="polar"] div div').first())).toBeGreaterThanOrEqual(22);
  expect(await size(apps.locator('[data-app="polar"] div div').nth(1))).toBeGreaterThanOrEqual(18);
  const infra = p.getByRole("region", { name: "INFRASTRUCTURE" });
  expect(await size(infra.getByRole("link").first())).toBeGreaterThanOrEqual(22);
  expect(
    await size(infra.getByText("Hosting, deployments and function logs")),
  ).toBeGreaterThanOrEqual(18);
  const claude = p.getByRole("region", { name: "CLAUDE" });
  expect(await size(claude.getByRole("button", { name: "CLAUDE USAGE" }))).toBeGreaterThanOrEqual(
    22,
  );
  expect(
    await size(claude.getByRole("link", { name: "Anthropic Console" })),
  ).toBeGreaterThanOrEqual(22);
  expect(await size(claude.getByText("Claude API usage and spend limits"))).toBeGreaterThanOrEqual(
    18,
  );
  expect(await size(p.getByRole("heading", { name: "Dashboard" }))).toBeGreaterThanOrEqual(34);
});

test("the usage table's type is larger on a monitor too", async ({ page: p }) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
      "users/u/ai_usage": [],
    },
  });
  await p.getByRole("button", { name: "CLAUDE USAGE" }).dblclick();
  const dialog = p.getByRole("dialog", { name: "Claude usage" });
  await expect(dialog).toBeVisible();
  const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(await size(dialog)).toBeGreaterThanOrEqual(16);
  expect(await size(dialog.getByLabel("Period"))).toBeGreaterThanOrEqual(15);
});

test("the CLAUDE USAGE entry has the same size, colour and font as the Anthropic Console link", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  });
  const style = (loc) =>
    loc.evaluate((e) => {
      const c = getComputedStyle(e);
      return [c.fontSize, c.color, c.fontFamily, c.letterSpacing];
    });
  const claude = p.getByRole("region", { name: "CLAUDE" });
  const usage = await style(claude.getByRole("button", { name: "CLAUDE USAGE" }));
  expect(usage).toEqual(await style(claude.getByRole("link", { name: "Anthropic Console" })));
  expect(usage[0]).toBe("22px");
  // written like the link, not in capitals
  await expect(claude.getByRole("button", { name: "Claude Usage" })).toHaveText("Claude Usage");
});
