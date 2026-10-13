// tests/ui/dashboard.spec.mjs — the Dashboard panel (Fix 98): a row per app with when it last gave
// data and a fresh / stale / missing marker, the Claude usage entry, and failed reads. Firebase is
// mocked; "now" is 11 Oct 2026, 12:00.
import { test, expect } from "./cover.mjs";
import { fontsReady } from "./fonts.mjs";

const start = async (p, init = {}, admin = null, infra = null) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  const seen = admin ? await adminApi(p, admin) : [];
  if (infra) await infraApi(p, infra);
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
  return seen;
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
const adminApi = async (p, { admin = true, users = USERS, fail = false, deleteReply } = {}) => {
  const seen = [];
  await p.route(
    (u) => new URL(u).pathname === "/api/admin-users",
    async (route) => {
      const req = route.request();
      const { action, uid } = req.postDataJSON();
      seen.push({
        action,
        auth: req.headers()["authorization"],
        ...(action === "delete" && { uid }),
      });
      if (action === "check") return route.fulfill({ json: { admin } });
      if (action === "delete") {
        const reply = deleteReply ?? { json: { ok: true } };
        await new Promise((res) => setTimeout(res, reply.delay ?? 0));
        return route.fulfill(reply);
      }
      if (fail) return route.fulfill({ status: 500, json: { error: "Could not list the users" } });
      return route.fulfill({ json: { users } });
    },
  );
  return seen;
};

const startAdmin = (p, options = {}) =>
  start(
    p,
    {
      __collections: {
        "users/u/apple_activity": [],
        "users/u/weight_log": [],
        "users/u/body_log": [],
      },
    },
    options,
  );
const openUsers = async (p) => {
  await p.getByRole("button", { name: "User accounts" }).click();
  const dialog = p.getByRole("dialog", { name: "Users" });
  await expect(dialog).toBeVisible();
  return dialog;
};

test("an admin sees a USERS card below the Claude card; the server is asked with the sign-in token", async ({
  page: p,
}) => {
  const seen = await startAdmin(p);
  const users = p.getByRole("region", { name: "USERS" });
  await expect(users).toBeVisible();
  const [claude, card] = [await box(p, "CLAUDE"), await box(p, "USERS")];
  expect(card.top).toBeGreaterThanOrEqual(claude.bottom); // below it
  expect(Math.abs(card.left - claude.left)).toBeLessThan(2); // in the same column
  await expect(users.getByRole("button", { name: "User accounts" })).toBeVisible();
  expect(seen[0]).toEqual({ action: "check", auth: "Bearer mock-id-token" });
});

test("not an admin, or a failed check: no USERS card", async ({ page: p }) => {
  await startAdmin(p, { admin: false });
  await expect(p.getByRole("region", { name: "CLAUDE" })).toBeVisible();
  await expect(p.getByRole("region", { name: "USERS" })).toHaveCount(0);
});

test("the Users table lists the users with their account details and ids", async ({ page: p }) => {
  const seen = await startAdmin(p);
  const dialog = await openUsers(p);
  expect(seen.at(-1)).toEqual({ action: "list", auth: "Bearer mock-id-token" });
  const heads = dialog.getByRole("columnheader");
  await expect(heads).toHaveText([
    "Name",
    "Email",
    "Phone",
    "Member since",
    "Last sign-in",
    "Sign-in",
    "Member ID",
    "User ID",
    "", // the column of Delete buttons
  ]);
  const rows = dialog.getByRole("row");
  await expect(rows).toHaveCount(3); // header + 2 users
  const jane = await rows.nth(1).getByRole("cell").allTextContents();
  expect(jane).toEqual([
    "Jane Smith",
    "jane@example.com",
    "+44 7700 000000",
    expect.stringMatching(/^01-Oct-2026 \d\d:\d\d$/),
    expect.stringMatching(/^11-Oct-2026 \d\d:\d\d$/),
    "Google, Email and password",
    "USR-ABC123",
    "FbUid123abcDEF456ghiJKL789", // the user id string
    "Delete", // the button of the last column (Fix 127)
  ]);
  const bob = await rows.nth(2).getByRole("cell").allTextContents();
  expect(bob.slice(0, 3)).toEqual(["", "bob@test.org", ""]);
  expect(bob[5]).toBe("Email and password (disabled)");
  await expect(dialog).toContainText("2 users");
});

test("search narrows the table by anything in a row, and the count follows", async ({
  page: p,
}) => {
  await startAdmin(p);
  const dialog = await openUsers(p);
  const search = dialog.getByRole("searchbox", { name: "Search users" });
  const rows = dialog.getByRole("row");
  await search.fill("JANE");
  await expect(rows).toHaveCount(2);
  await expect(dialog).toContainText("1 user");
  await expect(dialog).not.toContainText("2 users");
  await search.fill("xyz"); // part of a user id
  await expect(rows.nth(1)).toContainText("bob@test.org");
  await search.fill("london"); // the address, which has no column
  await expect(rows.nth(1)).toContainText("Jane Smith");
  await search.fill("disabled");
  await expect(rows.nth(1)).toContainText("bob@test.org");
  await search.fill("nobody at all");
  await expect(dialog.getByText("No users match.")).toBeVisible();
  await expect(dialog).toContainText("0 users");
  await search.fill("");
  await expect(rows).toHaveCount(3);
});

test("the Users table looks like the usage table: as wide as its content, bordered, centred headings, large type", async ({
  page: p,
}) => {
  await startAdmin(p);
  const dialog = await openUsers(p);
  const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const box = await dialog.evaluate((e) => e.getBoundingClientRect().toJSON());
  expect(box.height).toBeGreaterThan(900 * 0.9);
  expect(box.width).toBeLessThanOrEqual(1400);
  await fontsReady(p);
  const table = await dialog
    .locator("table")
    .evaluate((t) => ({ w: t.getBoundingClientRect().width, p: t.parentElement.clientWidth }));
  expect(table.w).toBeLessThanOrEqual(table.p + 1); // no white space beside the table
  expect(await size(dialog.getByRole("cell").first())).toBeGreaterThanOrEqual(16);
  const heads = dialog.getByRole("columnheader");
  expect(await heads.evaluateAll((hs) => hs.map((h) => getComputedStyle(h).textAlign))).toEqual(
    Array(9).fill("center"), // the eight columns and the one for the Delete button
  );
  expect(
    await dialog
      .getByRole("cell")
      .first()
      .evaluate((e) => getComputedStyle(e).borderTopWidth),
  ).toBe("1px");
  expect(await size(dialog.getByText("USERS", { exact: true }))).toBeGreaterThanOrEqual(20);
  expect(await size(dialog.getByText(/^\d+ users?$/))).toBeGreaterThanOrEqual(21);
});

test("the Users table closes with Esc, ✕ or a click outside", async ({ page: p }) => {
  await startAdmin(p);
  let dialog = await openUsers(p);
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  dialog = await openUsers(p);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  dialog = await openUsers(p);
  await dialog.getByRole("searchbox").click(); // inside: stays open
  await expect(dialog).toBeVisible();
  await p.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
});

test("a list that cannot be read says so", async ({ page: p }) => {
  await startAdmin(p, { fail: true });
  const dialog = await openUsers(p);
  await expect(dialog).toContainText("Could not load users: Could not list the users");
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

const startErrors = (p, errors = ERRORS, extra = {}) =>
  start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
      "users/u/app_errors": errors,
    },
    ...extra,
  });

test("an ERRORS card sits under YOUR APPS and says how many errors the last week had", async ({
  page: p,
}) => {
  await startErrors(p);
  const card = p.getByRole("region", { name: "ERRORS" });
  await expect(card).toBeVisible();
  const [apps, errors] = [await box(p, "YOUR APPS"), await box(p, "ERRORS")];
  expect(errors.top).toBeGreaterThanOrEqual(apps.bottom); // below it
  expect(Math.abs(errors.left - apps.left)).toBeLessThan(2); // in the same column
  await expect(card.getByRole("button", { name: "Recent errors" })).toBeVisible();
  await expect(card).toContainText("2 in the last 7 days · latest 3 hours ago"); // the 20-day-old one is not counted
});

test("when the only errors are older than a week the card says none in the last 7 days", async ({
  page: p,
}) => {
  await startErrors(p, [ERRORS[2]]);
  await expect(p.getByRole("region", { name: "ERRORS" })).toContainText("None in the last 7 days");
});

test("an unreadable error log says so on the card and in the table", async ({ page: p }) => {
  await startErrors(p, ERRORS, { __failGetDocs: true });
  await expect(p.getByRole("region", { name: "ERRORS" })).toContainText("Could not read the log");
  await p.getByRole("button", { name: "Recent errors" }).click();
  await expect(p.getByRole("dialog", { name: "Errors" })).toContainText(
    "Could not load the error log.",
  );
});

test("the errors table: newest first, with the kind, page and message, searchable, counted", async ({
  page: p,
}) => {
  await startErrors(p);
  await p.getByRole("button", { name: "Recent errors" }).click();
  const dialog = p.getByRole("dialog", { name: "Errors" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("columnheader")).toHaveText(["Date", "Kind", "Page", "Message"]);
  const rows = dialog.getByRole("row");
  await expect(rows).toHaveCount(4); // header + 3
  const first = await rows.nth(1).getByRole("cell").allTextContents();
  expect(first[0]).toMatch(/^\d\d-[A-Z][a-z]{2}-2026 \d\d:\d\d$/);
  expect(first.slice(1)).toEqual(["Logged", "/app.html", "Weight save failed Mock setDoc failure"]);
  expect(await rows.nth(2).getByRole("cell").allTextContents()).toContain("Promise");
  expect(await rows.nth(3).getByRole("cell").allTextContents()).toContain("Error");
  await expect(dialog).toContainText("3 errors");
  const search = dialog.getByRole("searchbox", { name: "Search errors" });
  await search.fill("network");
  await expect(rows).toHaveCount(2);
  await expect(dialog).toContainText("1 error");
  await search.fill("tracker.html promise");
  await expect(rows).toHaveCount(2);
  await search.fill("nothing like this");
  await expect(dialog.getByText("No errors match.")).toBeVisible();
  await expect(dialog).toContainText("0 errors");
  await search.fill("");
  await expect(rows).toHaveCount(4);
});

test("the errors table looks like the others: as wide as its content, bordered, centred headings, large type", async ({
  page: p,
}) => {
  await startErrors(p);
  await p.getByRole("button", { name: "Recent errors" }).click();
  const dialog = p.getByRole("dialog", { name: "Errors" });
  const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await fontsReady(p);
  const table = await dialog
    .locator("table")
    .evaluate((t) => ({ w: t.getBoundingClientRect().width, p: t.parentElement.clientWidth }));
  expect(table.w).toBeLessThanOrEqual(table.p + 1);
  expect(await size(dialog.getByRole("cell").first())).toBeGreaterThanOrEqual(16);
  expect(
    await dialog
      .getByRole("columnheader")
      .evaluateAll((hs) => hs.map((h) => getComputedStyle(h).textAlign)),
  ).toEqual(Array(4).fill("center"));
  expect(
    await dialog
      .getByRole("cell")
      .first()
      .evaluate((e) => getComputedStyle(e).borderTopWidth),
  ).toBe("1px");
  expect(await size(dialog.getByText("ERRORS", { exact: true }))).toBeGreaterThanOrEqual(20);
  expect(await size(dialog.getByText(/^\d+ errors?$/))).toBeGreaterThanOrEqual(21);
});

test("an empty log, and the errors table closing with Esc, ✕ or a click outside", async ({
  page: p,
}) => {
  await startErrors(p, []);
  await expect(p.getByRole("region", { name: "ERRORS" })).toContainText("None in the last 7 days");
  await p.getByRole("button", { name: "Recent errors" }).click();
  let dialog = p.getByRole("dialog", { name: "Errors" });
  await expect(dialog.getByText("No errors recorded.")).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await p.getByRole("button", { name: "Recent errors" }).click();
  dialog = p.getByRole("dialog", { name: "Errors" });
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await p.getByRole("button", { name: "Recent errors" }).click();
  await p.mouse.click(2, 2);
  await expect(p.getByRole("dialog", { name: "Errors" })).toHaveCount(0);
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
  canary: {
    runs: [
      { status: "completed", conclusion: "success", at: infraAgo(3) },
      { status: "completed", conclusion: "success", at: infraAgo(27) },
    ],
  },
  deployment: {
    environment: "Production",
    ref: "abc",
    state: "success",
    at: infraAgo(2),
    description: "",
  },
  issues: {
    issues: [
      {
        number: 161,
        title: "CI platform check",
        items: [
          "Java 21 is behind the latest LTS, 25",
          "Notice on the latest CI run: Node.js 20 is deprecated",
          "firebase-tools 15.32.1 is not the latest (15.33.0)",
        ],
      },
    ],
  },
  checked_at: infraAgo(0),
};
/** The mocked /api/infra-status; the Authorization headers it was asked with go in infraSeen. */
const infraSeen = [];
const infraApi = async (p, data = INFRA) => {
  infraSeen.length = 0;
  const seen = infraSeen;
  await p.route(
    (u) => new URL(u).pathname === "/api/infra-status",
    (route) => {
      seen.push(route.request().headers()["authorization"]);
      return route.fulfill({ json: data });
    },
  );
  return seen;
};

const startInfra = (p, data = INFRA) =>
  start(
    p,
    {
      __collections: {
        "users/u/apple_activity": [],
        "users/u/weight_log": [],
        "users/u/body_log": [],
      },
    },
    null,
    data,
  );
const link = (p, name) =>
  p.getByRole("region", { name: "INFRASTRUCTURE" }).locator(`[data-link="${name}"]`);

test("each infrastructure link shows a marker and live lines: platform, deployment, CI, issues", async ({
  page: p,
}) => {
  await startInfra(p);
  await expect(link(p, "Vercel")).toContainText("Platform: Minor Service Outage");
  await expect(link(p, "Vercel")).toContainText("Production: deployed 2 hours ago");
  await expect(link(p, "Firebase")).toContainText("Platform: no ongoing incidents");
  await expect(link(p, "GitHub")).toContainText("Platform: All Systems Operational");
  await expect(link(p, "GitHub Actions")).toContainText(
    "Latest on main: passed 1 hour ago · Fix 99: live status",
  );
  await expect(link(p, "GitHub Actions")).toContainText(
    "Ubuntu 26.04 canary: 2 of the last 2 runs passed · latest 3 hours ago",
  );
  await expect(link(p, "GitHub issues")).toContainText("1 open: CI platform check");
  await expect(link(p, "GitHub issues")).toContainText("Java 21 is behind the latest LTS, 25");
  await expect(link(p, "GitHub issues")).toContainText(
    "firebase-tools 15.32.1 is not the latest (15.33.0)",
  );
  await expect(link(p, "GitHub issues")).toContainText(
    "+ 1 notice on the latest CI run (see the issue)",
  );
  await expect(link(p, "GitHub issues")).not.toContainText("Node.js 20 is deprecated");
  // markers: the worst of what each link shows
  await expect(link(p, "Vercel").getByRole("img", { name: "Stale" })).toBeVisible(); // a platform incident
  await expect(link(p, "Firebase").getByRole("img", { name: "Up to date" })).toBeVisible();
  await expect(link(p, "GitHub").getByRole("img", { name: "Up to date" })).toBeVisible();
  await expect(link(p, "GitHub Actions").getByRole("img", { name: "Up to date" })).toBeVisible();
  await expect(link(p, "GitHub issues").getByRole("img", { name: "Stale" })).toBeVisible(); // one is open
  // the links themselves are unchanged
  await expect(link(p, "Vercel").getByRole("link", { name: "Vercel" })).toHaveAttribute(
    "href",
    "https://vercel.com/jsarathys-projects/vaulte",
  );
});

test("a failed deployment or CI run is an error marker; a failing source says it is unavailable", async ({
  page: p,
}) => {
  await startInfra(p, {
    ...INFRA,
    vercel: { indicator: "none", description: "All Systems Operational" },
    deployment: { ...INFRA.deployment, state: "failure" },
    ci: {
      runs: [
        {
          name: "ci",
          status: "completed",
          conclusion: "failure",
          title: "Broken",
          at: infraAgo(1),
        },
      ],
    },
    canary: { runs: [{ status: "completed", conclusion: "failure", at: infraAgo(3) }] },
    github: { error: true },
  });
  await expect(link(p, "Vercel")).toContainText("Production: failed 2 hours ago");
  await expect(link(p, "Vercel").getByRole("img", { name: "Error" })).toBeVisible();
  await expect(link(p, "GitHub Actions")).toContainText(
    "Latest on main: failed 1 hour ago · Broken",
  );
  await expect(link(p, "GitHub Actions").getByRole("img", { name: "Error" })).toBeVisible();
  await expect(link(p, "GitHub Actions")).toContainText(
    "Ubuntu 26.04 canary: 0 of the last 1 runs passed · latest 3 hours ago",
  );
  await expect(link(p, "GitHub")).toContainText("Platform status unavailable");
  await expect(link(p, "GitHub").getByRole("img", { name: "No data" })).toBeVisible();
});

test("when the status cannot be loaded every link says it is unavailable, and the links still work", async ({
  page: p,
}) => {
  await start(p, {
    __collections: {
      "users/u/apple_activity": [],
      "users/u/weight_log": [],
      "users/u/body_log": [],
    },
  }); // the generic mock answers {}
  await expect(link(p, "Vercel")).toContainText("Platform status unavailable");
  await expect(link(p, "Firebase")).toContainText("Platform status unavailable");
  await expect(link(p, "GitHub issues")).toContainText("Issues unavailable");
  await expect(p.getByRole("region", { name: "INFRASTRUCTURE" }).getByRole("link")).toHaveCount(5);
});

test("the status is asked for with the sign-in token", async ({ page: p }) => {
  await startInfra(p);
  await expect(link(p, "Firebase")).toContainText("no ongoing incidents");
  expect(infraSeen[0]).toBe("Bearer mock-id-token");
});

// ---- deleting a user (Fix 127)
const ADMIN_ROW = {
  uid: "FbUidAdmin",
  member_id: "USR-ADM",
  name: "Boss",
  email: "boss@example.com",
  phone: "",
  address: "",
  created: new Date(2026, 8, 1).toISOString(),
  last_sign_in: null,
  providers: ["google.com"],
  disabled: false,
  admin: true,
};
const dialogs = (p, accept = true) => {
  const seen = [];
  p.on("dialog", (d) => {
    seen.push([d.type(), d.message()]);
    return accept ? d.accept() : d.dismiss();
  });
  return seen;
};

test("the Users table offers Delete for each user except an admin", async ({ page: p }) => {
  await startAdmin(p, { users: [...USERS, ADMIN_ROW] });
  const dialog = await openUsers(p);
  await expect(dialog.getByRole("button", { name: /^Delete / })).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: "Delete jane@example.com" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete bob@test.org" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete boss@example.com" })).toHaveCount(0);
  const heads = await dialog.locator("th").allTextContents();
  expect(heads.length).toBe(9); // the eight columns and the empty one for the button
});

test("Delete asks first, naming the user; Cancel changes nothing and sends nothing", async ({
  page: p,
}) => {
  const seen = await startAdmin(p);
  const asked = dialogs(p, false);
  const dialog = await openUsers(p);
  await dialog.getByRole("button", { name: "Delete bob@test.org" }).click();
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0][0]).toBe("confirm");
  expect(asked[0][1]).toMatch(/^Delete bob@test\.org\?/);
  expect(asked[0][1]).toMatch(/It cannot be undone\.$/);
  await expect(dialog.getByText("2 users")).toBeVisible();
  expect(seen.filter((s) => s.action === "delete")).toEqual([]);
});

test("Delete, confirmed: the server is asked with the sign-in token, the row goes and the table says so", async ({
  page: p,
}) => {
  const seen = await startAdmin(p);
  dialogs(p, true);
  const dialog = await openUsers(p);
  await dialog.getByRole("button", { name: "Delete bob@test.org" }).click();
  await expect(dialog.getByText("Deleted bob@test.org.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete bob@test.org" })).toHaveCount(0);
  await expect(dialog.getByText("jane@example.com")).toBeVisible(); // the others are still there
  await expect(dialog.getByText("1 user", { exact: true })).toBeVisible();
  expect(seen.filter((s) => s.action === "delete")).toEqual([
    { action: "delete", auth: "Bearer mock-id-token", uid: "FbUid999xyz" },
  ]);
});

test("Delete refused or failed: the reason is shown and the user stays", async ({ page: p }) => {
  await startAdmin(p, {
    deleteReply: { status: 403, json: { error: "That is an admin account" } },
  });
  dialogs(p, true);
  const dialog = await openUsers(p);
  await dialog.getByRole("button", { name: "Delete jane@example.com" }).click();
  await expect(dialog.getByText("Could not delete: That is an admin account")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete jane@example.com" })).toBeVisible();
  await expect(dialog.getByText("2 users")).toBeVisible();
});

test("while a delete runs the Delete buttons are disabled", async ({ page: p }) => {
  await startAdmin(p, { deleteReply: { json: { ok: true }, delay: 600 } });
  dialogs(p, true);
  const dialog = await openUsers(p);
  await dialog.getByRole("button", { name: "Delete bob@test.org" }).click();
  await expect(dialog.getByRole("button", { name: "Delete jane@example.com" })).toBeDisabled();
  await expect(dialog.getByText("Deleted bob@test.org.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete jane@example.com" })).toBeEnabled();
});
