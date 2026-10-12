// tests/ui/ai-usage-card.spec.mjs — the Claude usage entry on My Account (Fix 84) and the table a
// double click opens (Fix 85, 86): one row per call with its date, newest first, filtered by period
// (a query on the records' time) and by feature, with totals. Firebase is mocked; "now" is
// 11 Oct 2026, 12:00 UTC.
import { test, expect } from "./cover.mjs";

const rec = (feature, at, input, output, cost) => ({
  id: at + feature,
  feature,
  at,
  input_tokens: input,
  output_tokens: output,
  cost_usd: cost,
});
const ROWS = [
  rec("chat", "2026-10-11T08:00:00.000Z", 4000, 300, 0.0165), // today
  rec("chat", "2026-10-09T08:00:00.000Z", 5000, 400, 0.021), // 2 days ago
  rec("create_recipe", "2026-10-01T08:00:00.000Z", 6000, 1200, 0.036), // 10 days ago
  rec("photo", "2026-08-01T08:00:00.000Z", 2000, 100, 0.0075), // 2 months ago
  rec("chat", "2026-03-01T08:00:00.000Z", 9000, 900, 0.0405), // 7 months ago, this year
  rec("chat", "2025-12-01T08:00:00.000Z", 1000, 100, 0.0045), // last year, within 1 year
  rec("chat", "2025-06-01T08:00:00.000Z", 1000, 100, 0.0045), // more than a year ago
];

const start = async (p, init) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
  await p.addInitScript((i) => Object.assign(window, i), {
    __authUser: { uid: "u", email: "jane@example.com" },
    __docs: { "users/u": { firstName: "Jane", lastName: "Smith", email: "jane@example.com" } },
    ...init,
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await p.locator(".app-sidebar button").nth(1).click();
  await expect(p.getByRole("heading", { name: "My Account" })).toBeVisible();
};
const open = async (p) => {
  await p.getByRole("button", { name: "CLAUDE USAGE" }).dblclick();
  const dialog = p.getByRole("dialog", { name: "Claude usage" });
  await expect(dialog).toBeVisible();
  return dialog;
};
const withRows = (rows = ROWS) => ({ __collections: { "users/u/ai_usage": rows } });

test("the CLAUDE USAGE heading has no box or summary; a double click on it opens the table, last 30 days to start", async ({
  page: p,
}) => {
  await start(p, withRows());
  await expect(p.getByRole("button", { name: "CLAUDE USAGE" })).toBeVisible();
  await expect(p.getByText(/Today \$|7 days \$|calls ·|Double-click/)).toHaveCount(0);
  await expect(p.locator(".info-card", { hasText: "CLAUDE USAGE" })).toHaveCount(0); // no box
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.getByRole("button", { name: "CLAUDE USAGE" }).click(); // one click: nothing
  await expect(p.getByRole("dialog")).toHaveCount(0);
  const dialog = await open(p);
  await expect(dialog.getByLabel("Period")).toHaveValue("30d");
  await expect(dialog.getByLabel("Feature")).toHaveValue("all");
  const rows = dialog.getByRole("row");
  await expect(rows).toHaveCount(4); // header + 3 calls in the last 30 days
  for (const h of ["Date", "Feature", "In", "Out", "Cost"])
    await expect(rows.first()).toContainText(h);
  await expect(rows.nth(1)).toContainText(/11 Oct \d\d:\d\d\s*chat\s*4000\s*300\s*1\.65¢/);
  await expect(rows.nth(3)).toContainText(/1 Oct \d\d:\d\d\s*create_recipe\s*6000\s*1200\s*3\.60¢/);
  await expect(dialog).toContainText("3 calls · 15000 in · 1900 out · 7.35¢");
});

test("each period queries the records from its start", async ({ page: p }) => {
  await start(p, withRows());
  const dialog = await open(p);
  const counts = {
    today: ["Today", 1, "1 calls · 4000 in · 300 out · 1.65¢"],
    "7d": ["Last 7 days", 2, "2 calls · 9000 in · 700 out · 3.75¢"],
    "30d": ["Last 30 days", 3, "3 calls · 15000 in · 1900 out · 7.35¢"],
    "3m": ["Last 3 months", 4, "4 calls · 17000 in · 2000 out · 8.10¢"],
    ytd: ["Year to date", 5, "5 calls · 26000 in · 2900 out · 12.15¢"],
    "1y": ["Last 1 year", 6, "6 calls · 27000 in · 3000 out · 12.60¢"],
  };
  for (const [key, [label, n, total]] of Object.entries(counts)) {
    await dialog.getByLabel("Period").selectOption(key);
    await expect(dialog.getByLabel("Period")).toHaveValue(key);
    await expect(dialog.getByRole("row")).toHaveCount(n + 1);
    await expect(dialog).toContainText(total);
    expect(label).toBeTruthy();
  }
  await expect(dialog.getByLabel("Period").locator("option")).toHaveText([
    "Today",
    "Last 7 days",
    "Last 30 days",
    "Last 3 months",
    "Last 1 year",
    "Year to date",
  ]);
});

test("the feature filter lists the features in the period and narrows the rows and the total", async ({
  page: p,
}) => {
  await start(p, withRows());
  const dialog = await open(p);
  await dialog.getByLabel("Period").selectOption("1y");
  const feature = dialog.getByLabel("Feature");
  await expect(feature.locator("option")).toHaveText([
    "All features",
    "chat",
    "create_recipe",
    "photo",
  ]);
  await feature.selectOption("chat");
  await expect(dialog.getByRole("row")).toHaveCount(5); // header + the 4 chat calls of the year
  await expect(dialog).toContainText("4 calls · 19000 in · 1700 out · 8.25¢");
  await dialog.getByLabel("Period").selectOption("today");
  await expect(feature).toHaveValue("chat"); // the choice is kept
  await expect(dialog.getByRole("row")).toHaveCount(2);
  await dialog.getByLabel("Period").selectOption("1y");
  await feature.selectOption("photo");
  await expect(dialog.getByRole("row")).toHaveCount(2);
  await dialog.getByLabel("Period").selectOption("7d"); // no photo calls this week
  await expect(feature).toHaveValue("photo");
  await expect(dialog).toContainText("No Claude calls recorded for this filter.");
  await expect(dialog).toContainText("0 calls · 0 in · 0 out · 0.00¢");
});

test("the table closes with Esc, the ✕ button or a click outside it", async ({ page: p }) => {
  await start(p, withRows());
  let dialog = await open(p);
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  dialog = await open(p);
  await p.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  dialog = await open(p);
  await dialog.click({ position: { x: 300, y: 300 } }); // inside: stays open
  await expect(dialog).toBeVisible();
  await p.mouse.click(2, 2); // on the backdrop
  await expect(dialog).toHaveCount(0);
});

test("a call with no known price shows n/a and adds nothing to the total", async ({ page: p }) => {
  await start(
    p,
    withRows([
      rec("chat", "2026-10-11T08:00:00.000Z", 100, 10, null),
      rec("chat", "2026-10-11T09:00:00.000Z", 100, 10, 0.5),
    ]),
  );
  const dialog = await open(p);
  await expect(dialog.getByRole("row").nth(2)).toContainText("n/a");
  await expect(dialog).toContainText("2 calls · 200 in · 20 out · 50.00¢");
});

test("no records at all", async ({ page: p }) => {
  await start(p, withRows([]));
  const dialog = await open(p);
  await expect(dialog).toContainText("No Claude calls recorded for this filter.");
});

test("records that cannot be read", async ({ page: p }) => {
  await start(p, { __failGetDocs: true });
  const dialog = await open(p);
  await expect(dialog).toContainText("Could not load usage.");
});

test("it takes most of the screen, capped by 1200px wide, and scrolls down for many calls", async ({
  page: p,
}) => {
  const at = (i) =>
    `2026-10-${String(11 - (i % 9)).padStart(2, "0")}T08:${String(i).padStart(2, "0")}:00.000Z`;
  const many = Array.from({ length: 60 }, (_, i) => rec("chat", at(i), 4000, 300, 0.0165));
  await start(p, withRows(many));
  const dialog = await open(p);
  const box = await dialog.evaluate((e) => e.getBoundingClientRect().toJSON());
  expect(box.width).toBeGreaterThan(1100);
  expect(box.width).toBeLessThanOrEqual(1200);
  expect(box.height).toBeGreaterThan(900 * 0.9); // 94% of the screen height
  expect(box.bottom).toBeLessThanOrEqual(900);
  const size = await dialog
    .locator("div")
    .nth(1)
    .evaluate((e) => ({ scrollH: e.scrollHeight, clientH: e.clientHeight }));
  expect(size.scrollH).toBeGreaterThan(size.clientH); // more rows than fit: it scrolls
});

test("on a monitor the table's records are large and bordered, the headings centred, the summary and title large; the My Account heading is larger", async ({
  page: p,
}) => {
  await start(p, withRows());
  const size = (loc) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(await size(p.getByRole("button", { name: "CLAUDE USAGE" }))).toBeGreaterThanOrEqual(15);
  const dialog = await open(p);
  await expect(dialog.getByRole("row")).toHaveCount(4);
  const cell = dialog.getByRole("cell").first();
  expect(await size(cell)).toBeGreaterThanOrEqual(19); // the records
  const borders = await cell.evaluate((e) => {
    const c = getComputedStyle(e);
    return [
      c.borderTopWidth,
      c.borderTopStyle,
      c.borderRightWidth,
      c.borderBottomWidth,
      c.borderLeftWidth,
    ];
  });
  expect(borders).toEqual(["1px", "solid", "1px", "1px", "1px"]);
  const heads = dialog.getByRole("columnheader");
  await expect(heads).toHaveCount(5);
  expect(await heads.evaluateAll((hs) => hs.map((h) => getComputedStyle(h).textAlign))).toEqual(
    Array(5).fill("center"),
  );
  expect(await heads.first().evaluate((h) => getComputedStyle(h).borderTopWidth)).toBe("1px");
  expect(await size(dialog.getByText("CLAUDE USAGE", { exact: true }))).toBeGreaterThanOrEqual(20); // the title
  expect(await size(dialog.getByText(/^\d+ calls · /))).toBeGreaterThanOrEqual(21); // the summary
});
