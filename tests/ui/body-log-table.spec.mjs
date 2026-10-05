// tests/ui/body-log-table.spec.mjs — the Body tab's log (Fix 26 PR 31): heading and Renpho tape
// sync (merging, saving, messages), the table (latest first, highlighting, empty state),
// editing a reading and deleting a row, pinned in tests/ui/fixtures/body-log-table.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test
// body-log-table --workers=1 (then review the JSON diff).
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/body-log-table.json", import.meta.url);
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

const ROWS = [
  { id: "2026-09-20", waist: 101.5, hip: 108, neck: 41 },
  { id: "2026-09-27", waist: 100.9, chest: 109.25 },
  { id: "2026-10-01", calfL: 39.2, shoulder: 0 }, // 0 is a reading
];

const start = async (p, rows = ROWS, init = {}) => {
  const api = { calls: [] };
  p.__api = api;
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.route("**/api/renpho-sync", async (r) => {
    api.calls.push({ body: JSON.parse(r.request().postData()), headers: r.request().headers() });
    const { status = 200, body = {}, raw, delay = 0 } = p.__reply || {};
    await new Promise((res) => setTimeout(res, delay));
    if (raw != null) return r.fulfill({ status, contentType: "text/html", body: raw });
    r.fulfill({ status, json: body });
  });
  await p.clock.install({ time: new Date("2026-10-04T10:00:00") });
  await p.addInitScript((i) => Object.assign(window, i), {
    __collections: { [P("body_log")]: rows },
    __docs: {},
    ...init,
  });
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Body", exact: true }).click();
  await p.getByText("📏 Body Log").waitFor();
};
const watch = (p) => {
  const out = { errs: [], logged: [], dialogs: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  p.on("dialog", (d) => {
    out.dialogs.push(d.message());
    p.__confirm === false ? d.dismiss() : d.accept();
  });
  return out;
};
const describe = (root) =>
  [root, ...root.querySelectorAll("*")].map((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join("");
    // CI's Chromium writes "border: none" as longhands
    const style = (el.getAttribute("style") ?? "").replace(
      /border(-bottom)?-width: medium; border\1-style: none; border\1-color: currentcolor;( border-image: none;)?/g,
      "border$1: none;",
    );
    const attrs = ["type", "step", "min", "max", "placeholder", "title", "colspan", "disabled"]
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`);
    const value = el.tagName === "INPUT" ? [`value=${el.value}`] : [];
    return [el.tagName, style, ...attrs, ...value, ...(own.trim() ? [`"${own}"`] : [])].join(" | ");
  });
const heading = (p) => p.getByText("📏 Body Log").locator("..");
const logBox = (p) => heading(p).locator("xpath=following-sibling::div[1]");
const shapes = async (p) => ({
  heading: await heading(p).evaluate(describe),
  table: await logBox(p).evaluate(describe),
});
const dates = (p) => logBox(p).locator("tbody tr td:first-child").allTextContents();
const row = (p, date) => logBox(p).locator("tbody tr", { hasText: date });
// the input for a site (column order: neck, shoulder, bicepL, bicepR, chest, waist, abdomen, …)
const SITES = ["neck", "shoulder", "bicepL", "bicepR", "chest", "waist", "abdomen", "hip"].concat([
  "thighL",
  "thighR",
  "calfL",
  "calfR",
]);
const cell = (p, date, site) => row(p, date).locator("input").nth(SITES.indexOf(site));
const saves = (p) => p.evaluate(() => window.__setDocs.filter((s) => s.path.includes("body_log")));
const syncBtn = (p) => heading(p).getByRole("button");
const note = (p) => heading(p).locator("span");

test("the log: columns, latest first, highlighting; empty", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  expect(await logBox(p).locator("th").allTextContents()).toEqual([
    "Date",
    "Neck",
    "Shldr",
    "L-Bicep",
    "R-Bicep",
    "Chest",
    "Waist",
    "Abdo",
    "Hip",
    "L-Thigh",
    "R-Thigh",
    "L-Calf",
    "R-Calf",
    "",
  ]);
  expect(await dates(p)).toEqual(["2026-10-01", "2026-09-27", "2026-09-20"]);
  await expect(cell(p, "2026-09-27", "chest")).toHaveValue("109.25");
  await expect(cell(p, "2026-09-27", "hip")).toHaveValue("");
  await expect(note(p)).toHaveText("cm · click a date in the calendar to add a row");
  matchGolden("three-rows", await shapes(p));

  await start(p, [{ id: "2026-09-20", waist: 100 }], {});
  matchGolden("one-row", await shapes(p));
  await start(p, []);
  await expect(
    logBox(p).getByText("No measurements yet — click a date in the calendar to start a row."),
  ).toBeVisible();
  matchGolden("empty", await shapes(p));
  expect(w.errs).toEqual([]);
});

test("editing a reading saves the row", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  await cell(p, "2026-09-27", "hip").fill("107.4");
  await expect.poll(() => saves(p)).toHaveLength(1);
  expect((await saves(p)).at(-1)).toEqual({
    path: P("body_log/2026-09-27"),
    data: { date: "2026-09-27", waist: 100.9, chest: 109.25, hip: 107.4 },
  });
  await expect(cell(p, "2026-09-27", "hip")).toHaveValue("107.4");
  matchGolden("edited", await logBox(p).locator("tbody tr").nth(1).evaluate(describe));
  // the chart follows
  await p.getByRole("button", { name: "Hip", exact: true }).click();
  await expect(
    p.locator('svg[preserveAspectRatio="xMidYMid meet"] circle[fill="#378ADD"]'),
  ).toHaveCount(2);

  // clearing it saves null; a blank of spaces too
  await cell(p, "2026-09-27", "hip").fill("");
  await expect.poll(async () => (await saves(p)).at(-1).data.hip).toBe(null);
  await expect(cell(p, "2026-09-27", "hip")).toHaveValue("");
  await cell(p, "2026-10-01", "calfL").fill(" ");
  await expect
    .poll(async () => (await saves(p)).at(-1))
    .toEqual({
      path: P("body_log/2026-10-01"),
      data: { date: "2026-10-01", calfL: null, shoulder: 0 },
    });
  // "-" isn't a number yet: null
  await cell(p, "2026-09-20", "neck").pressSequentially("-");
  await expect.poll(async () => (await saves(p)).at(-1).data.neck).toBe(null);

  // a failed save is logged; the value stays on screen
  await p.evaluate(() => (window.__failSetDoc = true));
  await cell(p, "2026-09-20", "waist").fill("99");
  await expect.poll(() => w.logged.some((l) => l.startsWith("body row save failed"))).toBe(true);
  await expect(cell(p, "2026-09-20", "waist")).toHaveValue("99");
  expect(w.errs).toEqual([]);
});

test("deleting a row: confirm, cancel, failure", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  const del = (date) => row(p, date).getByTitle("Delete row");
  p.__confirm = false;
  await del("2026-09-27").click();
  expect(w.dialogs).toEqual(["Delete body measurements for 2026-09-27?"]);
  expect(await dates(p)).toHaveLength(3);
  expect(await p.evaluate(() => window.__deletedDocs ?? [])).toEqual([]);

  p.__confirm = true;
  await p.evaluate(() => (window.__failDeleteDoc = true));
  await del("2026-09-27").click();
  await expect.poll(() => w.logged.some((l) => l.startsWith("body row delete failed"))).toBe(true);
  expect(await dates(p)).toHaveLength(3);

  await p.evaluate(() => (window.__failDeleteDoc = false));
  await del("2026-10-01").click();
  await expect.poll(() => dates(p)).toEqual(["2026-09-27", "2026-09-20"]);
  expect(await p.evaluate(() => window.__deletedDocs)).toEqual([P("body_log/2026-10-01")]);
  matchGolden("after-delete", await shapes(p)); // the newest row is highlighted again
  expect(w.errs).toEqual([]);
});

test("Renpho tape sync: merging, saving, messages", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  p.__reply = {
    delay: 1000,
    body: {
      records: [
        { date: "2026-09-27", values: { waist: 100.5, abdomen: 103 } }, // over a manual row
        { date: "2026-09-24", values: { hip: 107.8 } }, // a new day
      ],
    },
  };
  await syncBtn(p).click();
  await expect(syncBtn(p)).toHaveText("Syncing…");
  await expect(syncBtn(p)).toBeDisabled();
  matchGolden("syncing", await heading(p).evaluate(describe));
  expect(p.__api.calls[0].body).toEqual({ userId: "u", kind: "girth" });
  expect(p.__api.calls[0].headers["content-type"]).toBe("application/json");
  await expect(note(p)).toHaveText("Synced 2 days.");
  await expect(syncBtn(p)).toHaveText("⟳ Sync Renpho");
  matchGolden("synced", await heading(p).evaluate(describe));
  expect(await dates(p)).toEqual(["2026-10-01", "2026-09-27", "2026-09-24", "2026-09-20"]);
  expect(await saves(p)).toEqual([
    {
      path: P("body_log/2026-09-27"),
      data: { date: "2026-09-27", waist: 100.5, chest: 109.25, abdomen: 103 },
    },
    { path: P("body_log/2026-09-24"), data: { date: "2026-09-24", hip: 107.8 } },
  ]);
  await expect(cell(p, "2026-09-27", "chest")).toHaveValue("109.25"); // manual value kept
  // the message clears after 6 s
  await p.clock.runFor(4500);
  await expect(note(p)).toHaveText("Synced 2 days.");
  await p.clock.runFor(1600);
  await expect(note(p)).toHaveText("cm · click a date in the calendar to add a row");

  p.__reply = { body: { records: [{ date: "2026-10-02", values: { neck: 40.5 } }] } };
  await syncBtn(p).click();
  await expect(note(p)).toHaveText("Synced 1 day.");
  expect((await dates(p))[0]).toBe("2026-10-02");

  // syncing again clears the last message straight away
  p.__reply = { delay: 1000, body: { records: [] } };
  await syncBtn(p).click();
  await expect(syncBtn(p)).toHaveText("Syncing…");
  expect(await note(p).textContent()).toBe("cm · click a date in the calendar to add a row");
  await expect(note(p)).toHaveText("No tape measurements found.");
  expect(await note(p).evaluate((e) => e.style.color)).toBe("rgb(46, 125, 50)"); // green
  await p.clock.runFor(6100);
  p.__reply = { body: {} };
  await syncBtn(p).click();
  await expect(note(p)).toHaveText("No tape measurements found.");
  await p.clock.runFor(6100);

  // failures: the server's message, else the status; red
  p.__reply = { status: 502, body: { error: "Renpho login failed" } };
  await syncBtn(p).click();
  await expect(note(p)).toHaveText("Renpho login failed");
  matchGolden("failed", await heading(p).evaluate(describe));
  await p.clock.runFor(6100);
  p.__reply = { status: 500, raw: "<html>oops</html>" };
  await syncBtn(p).click();
  await expect(note(p)).toHaveText("Sync failed (HTTP 500)");
  await p.clock.runFor(6100);
  // a failed save is a failed sync
  p.__reply = { body: { records: [{ date: "2026-10-03", values: { neck: 40 } }] } };
  await p.evaluate(() => (window.__failSetDoc = true));
  await syncBtn(p).click();
  await expect(note(p)).toHaveText("Mock setDoc failure");
  expect(await dates(p)).not.toContain("2026-10-03");
  expect(w.errs).toEqual([]);
});

test("sync: one at a time", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  p.__reply = { delay: 1500, body: { records: [] } };
  await syncBtn(p).click();
  await expect(syncBtn(p)).toBeDisabled();
  await syncBtn(p).dispatchEvent("click"); // a disabled button's click does nothing
  await expect(note(p)).toHaveText("No tape measurements found.");
  expect(p.__api.calls).toHaveLength(1);
  expect(w.errs).toEqual([]);
});
