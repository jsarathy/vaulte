// tests/ui/tracker-actions.spec.mjs — NutritionTracker's own actions (Fix 26 PR 19): saving a
// day (Compare slots follow), deleting an entry, switching day, calendar clicks per tab, the
// sidebar's 7-day average and streak, weight plan save, Renpho sync, purge, and Polar sync.
import { test, expect } from "./cover.mjs";

const P = (x) => `users/u/${x}`;
const day = (date, kcal, id = "m" + date) => ({
  date,
  notes: "",
  meals: [
    {
      id,
      name: "Breakfast",
      items: kcal == null ? [] : [{ id: "i" + date, name: "Food " + date, kcal }],
    },
  ],
});

const start = async (p, init = {}) => {
  const api = { renpho: [], polar: [] };
  p.__api = api;
  await p.route("**/api/renpho-sync", async (r) => {
    api.renpho.push(JSON.parse(r.request().postData()));
    const { status = 200, body = {}, delay = 0 } = p.__renpho || {};
    await new Promise((res) => setTimeout(res, delay));
    r.fulfill({ status, json: body });
  });
  await p.route("**/api/polar-sync", async (r) => {
    api.polar.push(JSON.parse(r.request().postData()));
    const { status = 200, body = {}, delay = 0 } = p.__polarSync || {};
    await new Promise((res) => setTimeout(res, delay));
    r.fulfill({ status, json: body });
  });
  await p.route(
    (u) => {
      const path = new URL(u).pathname;
      return path.startsWith("/api/") && !/renpho-sync|polar-sync/.test(path);
    },
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
};
const watch = (p) => {
  const out = { errs: [], logged: [], dialogs: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  p.on("dialog", (d) => {
    out.dialogs.push(d.message());
    d.accept();
  });
  return out;
};
const tab = async (p, name) => {
  await p.getByRole("button", { name, exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" }); // the tab's code downloads on first open
};
const clickDay = (p, n) =>
  p.evaluate((d) => {
    [...document.querySelectorAll("div[title]")]
      .find((el) => el.style.fontFamily && el.childNodes[0]?.nodeValue === String(d))
      .click();
  }, n);
const openDay = (p) =>
  p.evaluate(
    () =>
      [...document.querySelectorAll("div[title]")].find(
        (el) => el.style.fontFamily && el.style.background === "rgb(55, 138, 221)",
      )?.childNodes[0].nodeValue ?? null,
  );
const slots = async (p) => {
  await tab(p, "Compare");
  const heads = await p
    .locator('div[style*="repeat(5"] > div > div:first-child > span')
    .allTextContents();
  return heads.map((h) => h.replace(/^\w+,? /, "")); // "1 Oct", "— pick —" …
};
// Compare columns' bodies ("—" when a slot has no day)
const columns = (p) =>
  p
    .locator('div[style*="repeat(5"] > div > div:nth-child(2)')
    .evaluateAll((es) => es.map((e) => e.textContent.split(/\s/)[0] || ""));
const stat = (p, name) =>
  p.getByText(name, { exact: true }).locator("xpath=following-sibling::span[1]").textContent();
// The Daily log's "net kcal" figure for the day it shows
const netKcal = async (p) =>
  (await p.locator("body").innerText()).match(/\n(-?[\d,]+)\nnet kcal of/)?.[1] ?? null;
const addFood = async (p, date, kcal) => {
  await tab(p, "Add entry");
  await p.locator('input[type="date"]').first().fill(date);
  await p
    .locator("select")
    .filter({ has: p.locator("option", { hasText: "— select —" }) })
    .first()
    .selectOption({ index: 1 });
  await p.locator('xpath=//div[div[normalize-space(.)="kcal"]]/input').first().fill(String(kcal));
  await p.getByPlaceholder("e.g. Pinto bean stew (1 portion)").fill("Toast");
  await p.getByRole("button", { name: "Add Item" }).click();
  await expect(p.getByText("✅ Item added!")).toBeVisible();
};

test("saving days: Compare slots, Daily log, sidebar stats", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  // Sidebar: average of the first 7 days loaded, and days logged in a row up to today
  expect(await stat(p, "7-day avg")).toBe("-49 kcal"); // (52 + 0 + 0 − 250) / 4, rounded
  expect(await stat(p, "Streak")).toBe("4 days");
  expect(await slots(p)).toEqual(["1 Oct", "4 Oct", "— pick —", "— pick —", "— pick —"]);

  // A newer day with entries goes first in Compare; the Daily log shows the saved day
  await addFood(p, "2026-10-09", 80);
  expect(await slots(p)).toEqual(["9 Oct", "1 Oct", "4 Oct", "— pick —", "— pick —"]);
  await tab(p, "Daily log");
  expect(await netKcal(p)).toBe("80"); // (sic) the saved day's figures, under the open day's date
  await clickDay(p, 9); // opening it uses the saved copy (not stored in the harness's Firestore)
  await p.waitForTimeout(200);
  expect(await netKcal(p)).toBe("80");
  await clickDay(p, 1);
  // days are now newest first: the average covers the saved day too; the streak doesn't change
  expect(await stat(p, "7-day avg")).toBe("-24 kcal"); // (80 − 250 + 0 + 0 + 52) / 5
  expect(await stat(p, "Streak")).toBe("4 days");
  const title = await p.evaluate(
    () =>
      [...document.querySelectorAll("div[title]")].find(
        (el) => el.style.fontFamily && el.childNodes[0]?.nodeValue === "9",
      ).title,
  );
  expect(title).toBe("80 kcal");

  // An older day, or one already shown (even the newest), leaves Compare alone
  await addFood(p, "2026-10-09", 5);
  expect(await slots(p)).toEqual(["9 Oct", "1 Oct", "4 Oct", "— pick —", "— pick —"]);
  await addFood(p, "2026-10-02", 10);
  expect(await slots(p)).toEqual(["9 Oct", "1 Oct", "4 Oct", "— pick —", "— pick —"]);
  await addFood(p, "2026-10-04", 10);
  expect(await slots(p)).toEqual(["9 Oct", "1 Oct", "4 Oct", "— pick —", "— pick —"]);
  expect(w.errs).toEqual([]);
});

test("sidebar: newest 7 days after a save; a re-saved day counted once", async ({ page: p }) => {
  const kcal = { "09-27": 800, "09-28": 100, "09-29": 50 };
  const dates = ["10-04", "10-03", "10-02", "10-01", "09-30", "09-29", "09-28", "09-27"]; // newest first
  await start(p, { __days: dates.map((d) => day("2026-" + d, kcal[d] ?? 100)) });
  expect(await stat(p, "7-day avg")).toBe("93 kcal"); // the newest 7, once all 8 days are in: 650 / 7
  expect(await stat(p, "Streak")).toBe("8 days");
  await addFood(p, "2026-10-05", 100);
  expect(await stat(p, "7-day avg")).toBe("93 kcal"); // newest 7: 650 / 7
  await addFood(p, "2026-10-05", 800);
  expect(await stat(p, "7-day avg")).toBe("207 kcal"); // 10-05 now 900: 1,450 / 7
  expect(await stat(p, "Streak")).toBe("8 days"); // counted back from today
});

test("sidebar: thousands, nothing eaten, gaps, no days", async ({ page: p }) => {
  await start(p, {
    __days: [day("2026-10-04", 1200), day("2026-10-03", 300), day("2026-10-01", 300)],
  });
  expect(await stat(p, "7-day avg")).toBe("600 kcal");
  expect(await stat(p, "Streak")).toBe("2 days"); // stops at the gap (2 Oct)
  await start(p, { __days: [day("2026-10-04", 3000)] });
  expect(await stat(p, "7-day avg")).toBe("3,000 kcal");
  await start(p, { __days: [day("2026-10-04", null)] });
  expect(await stat(p, "7-day avg")).toBe("—");
  await start(p, { __days: [], __seedDays: [] });
  await expect(p.getByText("7-day avg")).toHaveCount(0);
  await expect(p.getByText("Streak")).toHaveCount(0);
});

test("deleting the last entry: day leaves Compare, next logged day fills in", async ({
  page: p,
}) => {
  const w = watch(p);
  const days = ["01", "02", "03", "04", "05", "06"].map((d) => day("2026-10-" + d, 100));
  days[0].meals[0].items.push({ id: "second", name: "Second food", kcal: 5 });
  await start(p, { __days: days });
  await p.evaluate(() =>
    localStorage.setItem("vaulte_collapsed_meals", JSON.stringify({ "m2026-10-01": false })),
  );
  await p.reload();
  await p.getByText("October 2026").waitFor();
  expect(await slots(p)).toEqual(["1 Oct", "2 Oct", "3 Oct", "4 Oct", "5 Oct"]);
  await tab(p, "Daily log");
  const row = p.locator("tr", { hasText: "Food 2026-10-01" });
  const second = p.locator("tr", { hasText: "Second food" });
  await second.locator("td").last().locator("button").click(); // confirm accepted
  await expect(second).toHaveCount(0);
  await expect(row).toHaveCount(1); // only that entry goes
  expect(await slots(p)).toEqual(["1 Oct", "2 Oct", "3 Oct", "4 Oct", "5 Oct"]); // still logged
  await tab(p, "Daily log");
  await row.locator("td").last().locator("button").click();
  await expect(row).toHaveCount(0);
  expect(w.dialogs).toEqual(["Remove this item?", "Remove this item?"]);
  const saved = await p.evaluate(() => window.__savedDays.at(-1));
  expect(saved.date).toBe("2026-10-01");
  expect(saved.meals.find((m) => m.id === "m2026-10-01").items).toEqual([]);
  expect(saved.meals.length).toBeGreaterThan(1); // default slots kept
  expect(await slots(p)).toEqual(["2 Oct", "3 Oct", "4 Oct", "5 Oct", "6 Oct"]);
  // emptied again (no entries left anywhere to remove): nothing more changes
  expect(w.errs).toEqual([]);
});

test("deleting: no other logged day to fill in", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  await p.evaluate(() =>
    localStorage.setItem("vaulte_collapsed_meals", JSON.stringify({ "m2026-10-01": false })),
  );
  await p.reload();
  await p.getByText("October 2026").waitFor();
  await tab(p, "Daily log");
  await p.locator("tr", { hasText: "Apple" }).locator("td").last().locator("button").click();
  await expect(p.locator("tr", { hasText: "Apple" })).toHaveCount(0);
  expect(await slots(p)).toEqual(["4 Oct", "— pick —", "— pick —", "— pick —", "— pick —"]);
  expect((await columns(p)).slice(1)).toEqual(["—", "—", "—", "—"]); // no stale figures
  expect(w.errs).toEqual([]);
});

test("switching day and calendar clicks per tab", async ({ page: p }) => {
  const w = watch(p);
  await start(p, { __days: [day("2026-10-01", 52)] });
  const chatDate = async () => {
    await p.getByTitle("Nutrition assistant").click();
    const v = await p.locator('input[type="date"]').last().inputValue();
    await p.getByTitle("Nutrition assistant").click();
    return v;
  };
  // Daily log: opens the day (stored or not) and moves the chat to it
  expect(await netKcal(p)).toBe("52");
  await clickDay(p, 4); // not loaded yet: read from Firestore, default meal slots filled in
  expect(await openDay(p)).toBe("4");
  await expect.poll(() => netKcal(p)).toBe("-250");
  await expect(p.getByText("🌙 Dinner")).toBeVisible();
  expect(await chatDate()).toBe("2026-10-04");
  await clickDay(p, 1);
  await expect.poll(() => netKcal(p)).toBe("52");
  await clickDay(p, 20); // nothing stored
  expect(await openDay(p)).toBe("20");
  await expect(p.getByText("Select a day to get started")).toBeVisible();
  expect(await chatDate()).toBe("2026-10-20");

  // Body: adds an empty row for the date (once); a failed write adds nothing
  await tab(p, "Body");
  await clickDay(p, 6);
  const bodySaves = () =>
    p.evaluate(() => window.__setDocs.filter((s) => s.path.includes("body_log")));
  await expect.poll(bodySaves).toHaveLength(1);
  expect((await bodySaves())[0]).toEqual({
    path: P("body_log/2026-10-06"),
    data: { date: "2026-10-06" },
  });
  await clickDay(p, 2);
  await expect.poll(bodySaves).toHaveLength(2);
  const dates = () =>
    p.locator("tbody tr td:first-child").evaluateAll((es) => es.map((e) => e.textContent));
  await expect.poll(dates).toEqual(["2026-10-06", "2026-10-02"]);
  await clickDay(p, 6);
  await p.waitForTimeout(300);
  expect((await bodySaves()).length).toBe(2);
  await p.evaluate(() => (window.__failSetDoc = true));
  await clickDay(p, 7);
  await expect.poll(() => w.logged.some((l) => l.startsWith("body row create failed"))).toBe(true);
  expect(await dates()).toEqual(["2026-10-06", "2026-10-02"]);
  expect(await openDay(p)).toBe("20"); // the open day doesn't move on these tabs
  expect(w.errs).toEqual([]);
});

test("weight plan save", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  await tab(p, "Weight");
  await p.getByText("✏ Edit").click();
  await p.locator('input[type="number"][value="33"]').fill("46"); // VO2max
  await p.getByText("💾 Save Plan").click();
  await expect(p.getByText("46 — Excellent")).toBeVisible();
  await expect(p.getByText("💾 Save Plan")).toHaveCount(0);
  const saved = await p.evaluate(() =>
    window.__setDocs.filter((s) => s.path === "users/u/weight_plan/settings"),
  );
  expect(saved.length).toBe(1);
  expect(saved[0].data).toMatchObject({ vo2max: 46, age: 60, startDate: "2026-08-16" });
  await p.getByText("✏ Edit").click();
  await expect(p.locator('input[type="number"][value="46"]')).toHaveCount(1);
  // a failed save is logged; the screen keeps the new values
  await p.evaluate(() => (window.__failSetDoc = true));
  await p.locator('input[type="number"][value="46"]').fill("30");
  await p.getByText("💾 Save Plan").click();
  await expect(p.getByText("30 — Fair")).toBeVisible();
  await expect.poll(() => w.logged.some((l) => l.startsWith("weight plan save failed"))).toBe(true);
  expect(w.errs).toEqual([]);
});

test("Renpho sync and purge", async ({ page: p }) => {
  const w = watch(p);
  await start(p, {
    __docs: { [P("weight_plan/settings")]: { syncFromDate: "2026-09-01" } },
    __collections: {
      [P("weight_log")]: [
        { id: "2026-08-20", actual: 86 },
        { id: "2026-08-25", actual: 85.5 },
        { id: "2026-09-01", actual: 85 }, // on the cutoff: kept
        { id: "2026-10-01", week: 7, dose: "5mg", actual: 84 },
      ],
    },
  });
  await tab(p, "Weight");
  const btn = p.getByRole("button", { name: /Sync Renpho|Syncing…/ });
  const weights = () =>
    p.evaluate(() =>
      window.__setDocs.filter((s) => s.path.includes("weight_log")).map((s) => s.data),
    );
  const msg = (t) => p.getByText(t, { exact: true });

  // Error from the server
  p.__renpho = { status: 500, body: { error: "Renpho login failed" }, delay: 300 };
  await btn.click();
  await expect(btn).toHaveText("Syncing…");
  await expect(btn).toBeDisabled();
  await expect(msg("Renpho login failed")).toBeVisible();
  expect(await msg("Renpho login failed").evaluate((e) => e.style.color)).toBe("rgb(198, 40, 40)");
  await expect(btn).toHaveText("⟳ Sync Renpho");
  expect(p.__api.renpho[0]).toEqual({ userId: "u", fromDate: "2026-09-01" });
  p.__renpho = { status: 500, body: {} };
  await btn.click();
  await expect(msg("Sync failed")).toBeVisible();

  // Nothing new: the server's warning, else a default message
  p.__renpho = { body: { records: [], warning: "Scale offline" } };
  await btn.click();
  await expect(msg("Scale offline")).toBeVisible();
  p.__renpho = { body: {} };
  await btn.click();
  await expect(msg("No measurements found.")).toBeVisible();
  expect(await msg("No measurements found.").evaluate((e) => e.style.color)).toBe(
    "rgb(46, 125, 50)",
  );
  expect(await weights()).toEqual([]);

  // Records: weight and scale metrics overwrite; manual fields kept; table updated
  p.__renpho = {
    body: {
      records: [
        { date: "2026-10-01", weight: 83.6, metrics: { fat: 30 } },
        { date: "2026-10-03", weight: 83.2 },
        { date: "2026-09-15", weight: 82.9 }, // earlier than rows already shown
      ],
      rejected: 2,
      fromDate: "2026-09-01",
    },
  };
  await btn.click();
  await expect(msg("Synced 3 measurements (2 before 2026-09-01 ignored).")).toBeVisible();
  expect(await weights()).toEqual([
    { date: "2026-10-01", week: 7, dose: "5mg", actual: 83.6, renpho: { fat: 30 } },
    { date: "2026-10-03", actual: 83.2 },
    { date: "2026-09-15", actual: 82.9 },
  ]);
  const actuals = () =>
    p
      .locator("tbody tr")
      .evaluateAll((rs) =>
        rs.map((r) => [...r.querySelectorAll("input")].map((i) => i.value).join("|")),
      );
  const shown = await actuals(); // latest first
  expect(shown.length).toBe(6);
  expect(shown[2]).toContain("82.9"); // 15 Sep sorted in, after 1 Oct
  p.__renpho = { body: { records: [{ date: "2026-10-05", weight: 83 }] } };
  await btn.click();
  await expect(msg("Synced 1 measurement.")).toBeVisible();
  // the message clears after 6 s
  await expect(msg("Synced 1 measurement.")).toHaveCount(0, { timeout: 8000 });

  // Purge: rows before the sync-from date, after confirming
  await p.getByRole("button", { name: "🗑 Purge 2 pre-2026-09-01" }).click();
  expect(w.dialogs.at(-1)).toBe("Delete 2 records dated before 2026-09-01? This cannot be undone.");
  await expect(p.getByRole("button", { name: /Purge/ })).toHaveCount(0);
  expect(await p.evaluate(() => window.__deletedDocs)).toEqual([
    P("weight_log/2026-08-20"),
    P("weight_log/2026-08-25"),
  ]);
  expect((await actuals()).length).toBe(5);
  expect(w.errs).toEqual([]);
});

test("Polar sync", async ({ page: p }) => {
  const w = watch(p);
  const old = { id: "a", sport: "RUNNING", start_time: "2026-10-01T08:00:00", calories: 1 };
  await start(p, {
    __docs: { [P("polar/connection")]: { connected: true, last_sync_at: "2026-10-02T07:00:00" } },
    __collections: { [P("polar_sessions")]: [old] },
  });
  await tab(p, "Add entry");
  const btn = p.getByRole("button", { name: /Sync/ }).filter({ hasText: /🔄|⏳/ });
  const msg = (t) => p.getByText(t, { exact: true });
  await expect(p.getByText("Synced 2 Oct, 07:00")).toBeVisible();

  p.__polarSync = { body: { newSessions: 0, sessions: [] }, delay: 300 };
  await btn.click();
  await expect(btn).toHaveText("⏳ Syncing…");
  await expect(msg("All up to date.")).toBeVisible();
  expect(p.__api.polar).toEqual([{ userId: "u" }]);
  await expect(p.getByText("Synced 4 Oct, 10:00")).toBeVisible(); // last sync = now
  await expect(btn).toHaveText("🔄 Sync");
  await expect(msg("All up to date.")).toHaveCount(0, { timeout: 7000 }); // after 5 s

  // New sessions: merged with the list (no duplicates, logged ones left out), newest first
  p.__polarSync = {
    body: {
      newSessions: 3,
      sessions: [
        { id: "a", sport: "RUNNING", start_time: "2026-10-01T08:00:00", calories: 9 },
        { id: "b", sport: "CYCLING", start_time: "2026-10-03T08:00:00", calories: 2 },
        { id: "c", sport: "ROWING", start_time: "2026-10-04T08:00:00", logged: true },
        { id: "d", sport: "WALKING", calories: 4 },
      ],
    },
  };
  await btn.click();
  await expect(msg("Synced 3 sessions.")).toBeVisible();
  await expect(p.getByText("3 unlogged sessions")).toBeVisible();
  const order = await p.evaluate(() =>
    ["Cycling", "Running", "Walking"]
      .map((n) => [n, document.body.innerHTML.indexOf(">" + n + "<")])
      .sort((a, b) => a[1] - b[1])
      .map((x) => x[0]),
  );
  expect(order).toEqual(["Cycling", "Running", "Walking"]);
  await expect(p.getByText("🔥 1 kcal")).toBeVisible(); // the existing copy of "a" is kept
  p.__polarSync = { body: { newSessions: 1, sessions: [] } };
  await btn.click();
  await expect(msg("Synced 1 session.")).toBeVisible();

  // Failure: the reason in red, for 6 s (a fresh page: earlier messages' timers would clear it)
  await start(p, { __docs: { [P("polar/connection")]: { connected: true } } });
  await tab(p, "Add entry");
  p.__polarSync = { status: 502, body: { error: "Polar is down" } };
  await btn.click();
  const bad = msg("Polar is down");
  await expect(bad).toBeVisible();
  expect(await bad.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(198, 40, 40)");
  await p.waitForTimeout(5300);
  await expect(bad).toBeVisible();
  await expect(bad).toHaveCount(0, { timeout: 2000 });
  p.__polarSync = { status: 502, body: {} };
  await btn.click();
  await expect(msg("Sync failed")).toBeVisible();
  expect(w.errs).toEqual([]);
});
