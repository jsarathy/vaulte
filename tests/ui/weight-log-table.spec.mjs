// tests/ui/weight-log-table.spec.mjs — the Weight tab's log (Fix 26 PR 22): heading buttons
// (Sync Renpho states, Purge with its confirm), the table (latest first, vs Proj, Cum Loss,
// 2-wk Loss, row shading, past / current rows) pinned in tests/ui/fixtures/weight-log-table.json,
// and editing Wk / Dose / Actual (saved per change; failures logged).
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test weight-log-table
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/weight-log-table.json", import.meta.url);
const UPDATE = !!process.env.UPDATE_GOLDEN;
const golden = UPDATE ? {} : JSON.parse(readFileSync(GOLDEN_FILE, "utf8"));
test.afterAll(() => {
  if (UPDATE) writeFileSync(GOLDEN_FILE, JSON.stringify(golden, null, 2) + "\n");
});
const matchGolden = (name, value) => {
  if (UPDATE) golden[name] = value;
  else expect(value, name).toEqual(golden[name]);
};

test.use({ timezoneId: "Europe/London" });
const P = (x) => `users/u/${x}`;

const LOG = [
  { id: "2026-08-10", actual: 86 }, // before the plan starts: no projection
  { id: "2026-08-17", week: 0, dose: "2.5mg", actual: 84.2 },
  { id: "2026-08-20", actual: 83.7, projected: 85 }, // saved projection beats the plan's
  { id: "2026-08-24", actual: 83.75, projected: 83.75 }, // on projection: 0.0
  { id: "2026-08-31", actual: 83.1 },
  { id: "2026-09-03", actual: 83.4 },
  { id: "2026-09-07", actual: 82.6 },
  { id: "2026-09-14", actual: 82.9 },
  { id: "2026-09-17", actual: 83.3 },
  { id: "2026-09-21", actual: 84.5 }, // a 2-week gain
  { id: "2026-09-28", actual: 80 }, // followed by a row without a reading: highlighted
  { id: "2026-10-01", week: 7, dose: "5mg" },
  { id: "2026-10-03", actual: 79.6 },
  { id: "2026-10-04", dose: "5mg" }, // today, no reading yet
  { id: "2026-10-05" }, // future
];

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Weight", exact: true }).click();
};
const withLog = (rows, plan) => ({
  __collections: { [P("weight_log")]: rows },
  __docs: plan ? { [P("weight_plan/settings")]: plan } : {}, // init scripts pile up
});
const watch = (p) => {
  const out = { errs: [], logged: [], dialogs: [], answer: true };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  p.on("dialog", (d) => {
    out.dialogs.push(d.message());
    out.answer ? d.accept() : d.dismiss();
  });
  return out;
};

const column = (p) => p.getByText("⚖️ Weight Log").locator("xpath=../..");
// Every element of the log column: tag, inline style, own text, input state
const shape = (p) =>
  column(p).evaluate((root) =>
    [root, ...root.querySelectorAll("*")].map((el) => {
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.nodeValue)
        .join("");
      // Chromium versions serialise "border: none" differently: normalise it
      const style = (el.getAttribute("style") ?? "").replace(
        "border-width: medium; border-style: none; border-color: currentcolor; border-image: none;",
        "border: none;",
      );
      const parts = [el.tagName, style];
      if (own.trim()) parts.push(`"${own}"`);
      if (el.tagName === "INPUT")
        parts.push(
          ...["type", "step", "min", "max", "placeholder"].map((a) => `${a}=${el.getAttribute(a)}`),
          `value=${el.value}`,
        );
      if (el.disabled) parts.push("disabled");
      return parts.join(" | ");
    }),
  );
// The table as text: one array of cell texts (input values for inputs) per row
const cells = (p) =>
  column(p)
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((r) =>
        [...r.children].map((td) => td.querySelector("input")?.value ?? td.textContent),
      ),
    );
const saves = (p) =>
  p.evaluate(() => window.__setDocs.filter((s) => s.path.includes("weight_log")));

test("table: latest first, figures, colours and highlights", async ({ page: p }) => {
  const w = watch(p);
  await start(p, withLog(LOG));
  await expect(column(p).locator("th")).toHaveText([
    "Wk",
    "Date",
    "Dose",
    "Actual (kg)",
    "vs Proj",
    "Cum Loss",
    "2-wk Loss",
  ]);
  expect(await cells(p)).toEqual([
    ["", "2026-10-05", "", "", "—", "—", "—"],
    ["", "2026-10-04", "5mg", "", "—", "—", "—"],
    ["", "2026-10-03", "", "79.6", "+4.0", "-6.9 kg", "-1.6 kg"],
    ["7", "2026-10-01", "5mg", "", "—", "—", "—"],
    ["", "2026-09-28", "", "80", "+3.7", "-6.5 kg", "-0.7 kg"],
    ["", "2026-09-21", "", "84.5", "+7.2", "-2.0 kg", "+0.5 kg"],
    ["", "2026-09-17", "", "83.3", "+5.5", "-3.2 kg", "-0.5 kg"],
    ["", "2026-09-14", "", "82.9", "+4.6", "-3.5 kg", "-0.7 kg"],
    ["", "2026-09-07", "", "82.6", "+3.0", "-3.9 kg", "-0.9 kg"],
    ["", "2026-09-03", "", "83.4", "+3.1", "-3.0 kg", "-1.2 kg"],
    ["", "2026-08-31", "", "83.1", "+2.2", "-3.4 kg", "-1.2 kg"],
    ["", "2026-08-24", "", "83.75", "0.0", "-2.7 kg", "-2.1 kg"],
    ["", "2026-08-20", "", "83.7", "-1.3", "-2.8 kg", "—"],
    ["0", "2026-08-17", "2.5mg", "84.2", "+0.6", "-2.3 kg", "—"],
    ["", "2026-08-10", "", "86", "—", "-0.5 kg", "—"],
  ]);
  const rows = column(p).locator("tbody tr");
  const bg = (i) => rows.nth(i).evaluate((r) => r.style.background);
  expect(await bg(0)).toBe("rgb(255, 255, 255)"); // index 14 (even)
  expect(await bg(1)).toBe("rgb(247, 250, 253)"); // index 13 (odd)
  expect(await bg(2)).toBe("rgb(227, 242, 253)"); // reading followed by none: current
  expect(await bg(4)).toBe("rgb(227, 242, 253)");
  expect(await bg(5)).toBe("rgb(247, 250, 253)");
  matchGolden("table", await shape(p));
  expect(w.errs).toEqual([]);
});

test("Cum Loss baseline; flat 2-wk Loss; latest reading last", async ({ page: p }) => {
  const w = watch(p);
  const rows = [
    { id: "2026-09-01", actual: 80 },
    { id: "2026-09-15", actual: 80 },
  ];
  await start(p, withLog(rows, { cumLossBaselineKg: "85.5" }));
  expect(await cells(p)).toEqual([
    ["", "2026-09-15", "", "80", "+1.9", "-5.5 kg", "0.0 kg"],
    ["", "2026-09-01", "", "80", "-0.7", "-5.5 kg", "—"],
  ]);
  matchGolden("flat", await shape(p));
  await start(p, withLog(rows, { cumLossBaselineKg: "lots" })); // falls back to 86.45
  await expect(column(p).locator("tbody tr").first().locator("td").nth(5)).toHaveText("-6.5 kg");
  // a cleared baseline falls back to 86.45 too (Fix 31)
  await start(p, withLog(rows, { cumLossBaselineKg: null }));
  await expect(column(p).locator("tbody tr").first().locator("td").nth(5)).toHaveText("-6.5 kg");
  // above the baseline: a gain
  await start(p, withLog(rows, { cumLossBaselineKg: "79" }));
  await expect(column(p).locator("tbody tr").first().locator("td").nth(5)).toHaveText("+1.0 kg");
  expect(w.errs).toEqual([]);
});

test("editing Wk, Dose and Actual saves the row", async ({ page: p }) => {
  const w = watch(p);
  await start(p, withLog(LOG));
  const row = (date) => column(p).locator("tbody tr").filter({ hasText: date });
  const input = (date, n) => row(date).locator("input").nth(n);

  await input("2026-10-04", 0).fill("8");
  await input("2026-10-04", 1).fill("7.5mg");
  await input("2026-10-04", 2).fill("79.35");
  expect((await saves(p)).map((s) => [s.path, s.data])).toEqual([
    [P("weight_log/2026-10-04"), { date: "2026-10-04", dose: "5mg", week: 8 }],
    [P("weight_log/2026-10-04"), { date: "2026-10-04", dose: "7.5mg", week: 8 }],
    [P("weight_log/2026-10-04"), { date: "2026-10-04", dose: "7.5mg", week: 8, actual: 79.35 }],
  ]);
  // the row now has a reading: figures and highlight follow; the row before loses its highlight
  await expect(row("2026-10-04").locator("td").nth(5)).toHaveText("-7.1 kg");
  expect(await row("2026-10-04").evaluate((r) => r.style.background)).toBe("rgb(227, 242, 253)");
  expect(await row("2026-10-03").evaluate((r) => r.style.background)).toBe("rgb(255, 255, 255)");
  matchGolden("after-edit", await shape(p));

  // blanking a number saves null; blank Dose saves ""
  await input("2026-10-04", 0).fill("");
  await input("2026-10-04", 2).fill("");
  await input("2026-10-04", 1).fill("");
  expect((await saves(p)).slice(3).map((s) => s.data)).toEqual([
    { date: "2026-10-04", dose: "7.5mg", week: null, actual: 79.35 },
    { date: "2026-10-04", dose: "7.5mg", week: null, actual: null },
    { date: "2026-10-04", dose: "", week: null, actual: null },
  ]);
  expect(await row("2026-10-03").evaluate((r) => r.style.background)).toBe("rgb(227, 242, 253)");
  // an existing row keeps its other fields (incl. a saved projection)
  await input("2026-08-20", 0).fill("1");
  expect((await saves(p)).at(-1)).toEqual({
    path: P("weight_log/2026-08-20"),
    data: { date: "2026-08-20", actual: 83.7, projected: 85, week: 1 },
  });

  // Dose is saved as typed
  await input("2026-10-05", 1).fill(" 5 mg ");
  expect((await saves(p)).at(-1).data).toEqual({ date: "2026-10-05", dose: " 5 mg " });

  // a failed save is logged; the screen keeps the edit
  await p.evaluate(() => (window.__failSetDoc = true));
  await input("2026-10-05", 2).fill("78");
  await expect.poll(() => w.logged.some((l) => l.startsWith("weight row save failed"))).toBe(true);
  await expect(input("2026-10-05", 2)).toHaveValue("78");
  await expect(row("2026-10-05").locator("td").nth(5)).toHaveText("-8.5 kg");
  expect(w.errs).toEqual([]);
});

test("heading: Sync Renpho states, Purge with its confirm", async ({ page: p }) => {
  const w = watch(p);
  await start(p, withLog(LOG)); // plan starts 2026-08-16: one row before it
  await p.route("**/api/renpho-sync", async (r) => {
    await new Promise((res) => setTimeout(res, 1000));
    r.fulfill({ status: 200, json: { records: [] } });
  });
  const sync = p.getByRole("button", { name: /Sync Renpho|Syncing…/ });
  const purge = p.getByRole("button", { name: /Purge/ });
  await expect(purge).toHaveText("🗑 Purge 1 pre-2026-08-16");
  matchGolden("heading", (await shape(p)).slice(0, 6));
  await sync.click();
  await expect(sync).toHaveText("Syncing…");
  await expect(sync).toBeDisabled();
  matchGolden("heading-syncing", (await shape(p)).slice(0, 6));
  const msg = p.getByText("No measurements found.", { exact: true });
  await expect(msg).toBeVisible();
  expect(await msg.evaluate((e) => e.getAttribute("style"))).toBe(
    "font-size: 11px; color: rgb(46, 125, 50);",
  );
  await expect(sync).toBeEnabled();

  // Cancel keeps the rows; OK purges
  w.answer = false;
  await purge.click();
  expect(w.dialogs).toEqual(["Delete 1 record dated before 2026-08-16? This cannot be undone."]);
  await expect(purge).toBeVisible();
  expect(await p.evaluate(() => window.__deletedDocs ?? [])).toEqual([]);
  w.answer = true;
  await purge.click();
  await expect(purge).toHaveCount(0);
  expect(await p.evaluate(() => window.__deletedDocs)).toEqual([P("weight_log/2026-08-10")]);

  // a later sync-from date counts more rows (not one on that date); none without any date
  await start(p, withLog(LOG, { syncFromDate: "2026-08-20" }));
  await expect(purge).toHaveText("🗑 Purge 2 pre-2026-08-20");
  await purge.click();
  expect(w.dialogs.at(-1)).toBe("Delete 2 records dated before 2026-08-20? This cannot be undone.");
  await start(p, withLog(LOG, { syncFromDate: "", startDate: "" }));
  await expect(column(p).locator("tbody tr")).toHaveCount(15);
  await expect(purge).toHaveCount(0);
  // the sync error message is red
  await p.unroute("**/api/renpho-sync");
  await p.route("**/api/renpho-sync", (r) => r.fulfill({ status: 500, json: { error: "Nope" } }));
  await sync.click();
  const err = p.getByText("Nope", { exact: true });
  await expect(err).toBeVisible();
  expect(await err.evaluate((e) => e.style.color)).toBe("rgb(198, 40, 40)");
  expect(w.errs).toEqual([]);
});
