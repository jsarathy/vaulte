// tests/ui/phone-dashboard.spec.mjs — the Dashboard on a phone (Fix 98, 99): reached from the bottom
// navigation; three rubrics (YOUR APPS, CLAUDE, INFRASTRUCTURE); a tap opens that box as a popup
// that fills the window, in larger type; Claude's opens the usage table.
import { test, expect } from "./cover.mjs";
import { fontsReady } from "./fonts.mjs";

const SCREEN = { width: 390, height: 844 };

const start = async (p, admin = null, infra = null) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  if (admin) await adminApi(p, admin);
  if (infra) await infraApi(p, infra);
  await p.clock.setFixedTime(new Date(2026, 9, 11, 12, 0, 0));
  await p.addInitScript(() => {
    window.__authUser = { uid: "u", email: "jane@example.com" };
    window.__docs = {
      "users/u": { firstName: "Jane", lastName: "Smith" },
      "users/u/polar/connection": {
        connected: true,
        last_sync_at: new Date(2026, 9, 11, 9, 0, 0).toISOString(), // 3 hours before "now"
      },
    };
    window.__collections = {
      "users/u/apple_activity": [],
      "users/u/weight_log": [{ id: "2026-10-10", date: "2026-10-10" }],
      "users/u/body_log": [],
      "users/u/ai_usage": [
        {
          id: "a",
          feature: "chat",
          at: "2026-10-11T08:00:00.000Z",
          input_tokens: 4000,
          output_tokens: 300,
          cost_usd: 0.0165,
        },
      ],
    };
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.locator(".app-sidebar button").nth(3).click(); // Home, My Account, Nutrition, Dashboard
  await expect(p.getByRole("heading", { name: "Dashboard" })).toBeVisible();
};
const rubric = (p, name) => p.getByRole("button", { name, exact: true });
const rect = (loc) => loc.evaluate((e) => e.getBoundingClientRect().toJSON());
const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));

test("three rubrics, nothing else, each inside the screen", async ({ page: p }) => {
  await start(p);
  for (const name of ["YOUR APPS", "CLAUDE", "INFRASTRUCTURE"]) {
    await expect(rubric(p, name)).toBeVisible();
    const b = await rect(rubric(p, name));
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(SCREEN.width);
    expect(b.height).toBeGreaterThanOrEqual(56); // a comfortable tap
  }
  for (const name of ["YOUR APPS", "CLAUDE", "INFRASTRUCTURE"])
    await expect(rubric(p, name)).toContainText("+"); // closed: a + to open it, as in My Account
  await expect(p.locator("[data-app]")).toHaveCount(0); // the cards are not open
  await expect(p.getByRole("dialog")).toHaveCount(0);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("YOUR APPS opens as a popup that fills the window, in large type; ✕ and Esc close it", async ({
  page: p,
}) => {
  await start(p);
  await rubric(p, "YOUR APPS").click();
  const dialog = p.getByRole("dialog", { name: "YOUR APPS" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog);
  expect([b.left, b.top, b.right, b.bottom]).toEqual([0, 0, SCREEN.width, SCREEN.height]);
  await expect(dialog.locator("[data-app]")).toHaveCount(4);
  await expect(dialog.locator('[data-app="weight"]')).toContainText("Last reading yesterday");
  await expect(dialog.locator('[data-app="polar"]')).toContainText("Last sync 3 hours ago");
  expect(await size(dialog.locator('[data-app="polar"] div div').first())).toBeGreaterThanOrEqual(
    22,
  );
  expect(await size(dialog.locator('[data-app="polar"] div div').nth(1))).toBeGreaterThanOrEqual(
    17,
  );
  for (const id of ["polar", "apple", "weight", "body"]) {
    const row = await rect(dialog.locator(`[data-app="${id}"]`));
    expect(row.left).toBeGreaterThanOrEqual(0);
    expect(row.right).toBeLessThanOrEqual(SCREEN.width);
  }
  await expect(dialog.getByRole("button", { name: "Close" })).toHaveText("−"); // open: a − to close it
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await rubric(p, "YOUR APPS").click();
  await expect(dialog).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("INFRASTRUCTURE opens as a popup with the links in large type", async ({ page: p }) => {
  await start(p);
  await rubric(p, "INFRASTRUCTURE").click();
  const dialog = p.getByRole("dialog", { name: "INFRASTRUCTURE" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog);
  expect([b.left, b.top, b.right, b.bottom]).toEqual([0, 0, SCREEN.width, SCREEN.height]);
  const links = dialog.getByRole("link");
  await expect(links).toHaveText([
    "Vercel",
    "Firebase",
    "GitHub",
    "GitHub Actions",
    "GitHub issues",
  ]);
  expect(await size(links.first())).toBeGreaterThanOrEqual(26);
  expect(
    await size(dialog.getByText("Hosting, deployments and function logs")),
  ).toBeGreaterThanOrEqual(20);
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("CLAUDE opens a popup with the usage entry and the Anthropic Console link; the entry opens the table", async ({
  page: p,
}) => {
  await start(p);
  await rubric(p, "CLAUDE").click();
  const dialog = p.getByRole("dialog", { name: "CLAUDE" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog);
  expect([b.left, b.top, b.right, b.bottom]).toEqual([0, 0, SCREEN.width, SCREEN.height]);
  const usage = dialog.getByRole("button", { name: "CLAUDE USAGE" });
  const link = dialog.getByRole("link", { name: "Anthropic Console" });
  await expect(link).toHaveAttribute("href", "https://console.anthropic.com");
  // the popup's title is the biggest type in it: bigger than the Claude usage entry and the link
  const title = await size(dialog.getByText("CLAUDE", { exact: true }));
  expect(title).toBeGreaterThanOrEqual(28);
  expect(title).toBeGreaterThan(await size(usage));
  expect(title).toBeGreaterThan(
    await size(dialog.getByRole("link", { name: "Anthropic Console" })),
  );
  expect(await size(usage)).toBeGreaterThanOrEqual(26);
  expect(await size(link)).toBeGreaterThanOrEqual(26);
  expect(await size(dialog.getByText("Claude API usage and spend limits"))).toBeGreaterThanOrEqual(
    20,
  );
  const style = (loc) =>
    loc.evaluate((e) => {
      const c = getComputedStyle(e);
      return [c.fontSize, c.color, c.fontFamily, c.letterSpacing];
    });
  expect(await style(usage)).toEqual(await style(link)); // the same size, colour and font as the link
  await expect(usage).toContainText("Claude Usage"); // written like the link, not in capitals
  expect(await usage.evaluate((e) => e.textContent.trim().startsWith("Claude Usage"))).toBe(true);
  await usage.click();
  const table = p.getByRole("dialog", { name: "Claude usage" });
  await expect(table).toContainText("1.65¢");
  expect(await size(table)).toBeGreaterThanOrEqual(16); // the table's type is larger on a phone
  expect(await size(table.getByLabel("Period"))).toBeGreaterThanOrEqual(16);
  await table.getByRole("button", { name: "Close" }).click();
  await expect(table).toHaveCount(0);
  await expect(dialog).toBeVisible(); // back to the Claude popup
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

const USERS = [
  {
    uid: "FbUid123abcDEF456ghiJKL789",
    member_id: "USR-ABC123",
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "+44 7700 000000",
    address: "1 High St, London, SW1A 1AA",
    created: new Date(2026, 9, 1, 8, 5).toISOString(),
    last_sign_in: new Date(2026, 9, 11, 9, 0).toISOString(),
    providers: ["google.com", "password"],
    disabled: false,
  },
  {
    uid: "FbUid999xyz",
    member_id: "",
    name: "",
    email: "bob@test.org",
    phone: "",
    address: "",
    created: null,
    last_sign_in: null,
    providers: ["password"],
    disabled: true,
  },
];
/** The mocked /api/admin-users: `admin` says who the caller is; the token must be sent. */
const adminApi = async (p, { admin = true, users = USERS, fail = false } = {}) => {
  const seen = [];
  await p.route(
    (u) => new URL(u).pathname === "/api/admin-users",
    async (route) => {
      const req = route.request();
      const { action } = req.postDataJSON();
      seen.push({ action, auth: req.headers()["authorization"] });
      if (action === "check") return route.fulfill({ json: { admin } });
      if (fail) return route.fulfill({ status: 500, json: { error: "Could not list the users" } });
      return route.fulfill({ json: { users } });
    },
  );
  return seen;
};

test("an admin gets a fourth rubric, USERS, that opens the table full window; others do not", async ({
  page: p,
}) => {
  await start(p, {});
  await expect(rubric(p, "USERS")).toBeVisible();
  await expect(rubric(p, "USERS")).toContainText("+");
  await rubric(p, "USERS").click();
  const dialog = p.getByRole("dialog", { name: "Users" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog); // nearly the whole window, like the usage table
  expect(b.left).toBeGreaterThanOrEqual(0);
  expect(b.right).toBeLessThanOrEqual(SCREEN.width);
  expect(b.width).toBeGreaterThan(370);
  expect(b.height).toBeGreaterThan(SCREEN.height * 0.9);
  await expect(dialog.getByRole("row")).toHaveCount(3);
  await fontsReady(p);
  await dialog.getByRole("searchbox", { name: "Search users" }).fill("bob");
  await expect(dialog.getByRole("row")).toHaveCount(2);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("not an admin: three rubrics only", async ({ page: p }) => {
  await start(p, { admin: false });
  await expect(rubric(p, "CLAUDE")).toBeVisible();
  await expect(rubric(p, "USERS")).toHaveCount(0);
});

const hoursAgoAt = (h) =>
  new Date(new Date(2026, 9, 11, 12, 0, 0).getTime() - h * 3600000).toISOString();
const ERRORS = [
  {
    id: "e1",
    at: hoursAgoAt(3),
    source: "console",
    page: "/app.html",
    message: "Weight save failed Mock setDoc failure",
  },
  {
    id: "e2",
    at: hoursAgoAt(50),
    source: "promise",
    page: "/tracker.html",
    message: "Network request failed",
  },
  {
    id: "e3",
    at: hoursAgoAt(24 * 20),
    source: "error",
    page: "/app.html",
    message: "Cannot read properties of undefined",
  },
];

test("ERRORS is a rubric that opens the error log full window, searchable", async ({ page: p }) => {
  await p.route("**/__never__", (r) => r.abort());
  await start(p);
  await expect(rubric(p, "ERRORS")).toBeVisible();
  await expect(rubric(p, "ERRORS")).toContainText("+");
  // the page has no app_errors yet: seed them and reopen
  await p.evaluate((rows) => (window.__collections["users/u/app_errors"] = rows), ERRORS);
  await rubric(p, "ERRORS").click();
  const dialog = p.getByRole("dialog", { name: "Errors" });
  await expect(dialog).toBeVisible();
  const b = await rect(dialog);
  expect(b.left).toBeGreaterThanOrEqual(0);
  expect(b.right).toBeLessThanOrEqual(SCREEN.width);
  expect(b.height).toBeGreaterThan(SCREEN.height * 0.9);
  await expect(dialog.getByRole("row")).toHaveCount(4);
  await dialog.getByRole("searchbox", { name: "Search errors" }).fill("promise");
  await expect(dialog.getByRole("row")).toHaveCount(2);
  expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

const infraAgo = (h) =>
  new Date(new Date(2026, 9, 11, 12, 0, 0).getTime() - h * 3600000).toISOString();
const INFRA = {
  vercel: { indicator: "minor", description: "Minor Service Outage" },
  github: { indicator: "none", description: "All Systems Operational" },
  firebase: { ongoing: [] },
  ci: {
    runs: [
      {
        name: "ci",
        status: "completed",
        conclusion: "success",
        title: "Fix 99: live status",
        at: infraAgo(1),
      },
      {
        name: "security",
        status: "completed",
        conclusion: "success",
        title: "Fix 99: live status",
        at: infraAgo(1),
      },
    ],
  },
  deployment: {
    environment: "Production",
    ref: "abc",
    state: "success",
    at: infraAgo(2),
    description: "",
  },
  issues: { issues: [{ number: 161, title: "CI platform check" }] },
  checked_at: infraAgo(0),
};
/** The mocked /api/infra-status; returns what was asked with. */
const infraApi = async (p, data = INFRA) => {
  const seen = [];
  await p.route(
    (u) => new URL(u).pathname === "/api/infra-status",
    (route) => {
      seen.push(route.request().headers()["authorization"]);
      return route.fulfill({ json: data });
    },
  );
  return seen;
};

test("INFRASTRUCTURE in the phone popup shows the live lines and markers in large type", async ({
  page: p,
}) => {
  await start(p, null, INFRA);
  await rubric(p, "INFRASTRUCTURE").click();
  const dialog = p.getByRole("dialog", { name: "INFRASTRUCTURE" });
  const vercel = dialog.locator('[data-link="Vercel"]');
  await expect(vercel).toContainText("Platform: Minor Service Outage");
  await expect(vercel).toContainText("Production: deployed 2 hours ago");
  await expect(vercel.getByRole("img", { name: "Stale" })).toBeVisible();
  await expect(dialog.locator('[data-link="GitHub Actions"]')).toContainText(
    "Latest on main: passed 1 hour ago",
  );
  expect(await size(vercel.getByText("Platform: Minor Service Outage"))).toBeGreaterThanOrEqual(20);
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});
