// tests/ui/apple-activity-card.spec.mjs — the Daily log's Apple Watch Activity card (Fix 26
// PR 44): loading / empty / synced states, the collapsed summary, the table (steps, active
// minutes, flights with kcal at the calculator's weight), Polar-session exclusions from 5-min
// slots and from daily totals ("estimated"), the kcal reported up to the day's net kcal, and a
// listener failure.
import { test, expect } from "./cover.mjs";

test.use({ timezoneId: "Europe/London" });
const P = (x) => `users/u/${x}`;
const LS = "vaulte_collapsed_meals";
const DATE = "2026-10-04";
const run = (start, mins, sport = "RUNNING") => ({
  start_time: `${DATE}T${start}:00`,
  duration_min: mins,
  sport,
});
const day = (items = []) => ({
  date: DATE,
  notes: "",
  meals: [{ id: "mX", name: "🏋️ Morning Exercise", is_exercise: 1, items }],
});
const polarItem = (id) => ({ id: "p" + id, name: "Run", kcal: -300, polar_session_id: id });
const CALC = { [P("settings/calculator")]: { weight: 70 } };

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date(`${DATE}T10:00:00`));
  await p.addInitScript(
    ({ i, LS }) => {
      localStorage.setItem(LS, JSON.stringify(i.__collapsed ?? { apple_activity: false })); // open
      Object.assign(window, i);
    },
    { i: { __days: [day()], __docs: { ...CALC }, ...init }, LS },
  );
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await expect(p.getByText("net kcal of")).toBeVisible();
};
const watch = (p) => {
  const out = { errs: [], logged: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  return out;
};
const style = (loc, prop) => loc.evaluate((e, k) => getComputedStyle(e)[k], prop);
const clickDay = (p, n) =>
  p.evaluate((d) => {
    [...document.querySelectorAll("div[title]")]
      .find((el) => el.style.fontFamily && el.childNodes[0]?.nodeValue === String(d))
      .click();
  }, n);
const title = (p) => p.getByText("⌚ Apple Watch Activity");
const card = (p) => title(p).locator("../../..");
const head = (p) => title(p).locator("../..");
const rows = (p) =>
  card(p)
    .locator("tr")
    .evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
// Apple's kcal as the calorie bar shows it: the net kcal falls by the burn, so burn = -net minus
// the logged exercise (these days log no food); "0" when nothing is reported
const burned = async (p, exercise = 0) => {
  const net = await p.getByText("net kcal of").locator("xpath=preceding-sibling::span").innerText();
  return String(-Number(net.replace(/,/g, "")) - exercise || 0);
};

test("empty: no data note, blank summary when collapsed; the header's look", async ({
  page: p,
}) => {
  const w = watch(p);
  await start(p);
  await expect(p.getByText("No Apple Watch data synced for this day yet")).toBeVisible();
  await expect(card(p).locator("table")).toHaveCount(0);
  expect(await style(head(p), "cursor")).toBe("pointer");
  expect(await style(head(p), "backgroundColor")).not.toBe("rgb(255, 255, 255)"); // open: tinted
  const chevron = head(p).locator("svg");
  expect(await style(chevron, "transform")).toBe("matrix(1, 0, 0, 1, 0, 0)"); // rotate(0deg)
  await expect(head(p).locator("span").nth(1)).toHaveText(""); // nothing synced
  await expect(head(p).locator("span")).toHaveCount(2); // no summary while open
  await title(p).click(); // collapse
  expect(await style(head(p), "backgroundColor")).toBe("rgb(255, 255, 255)");
  await expect(chevron).toHaveCSS("transform", "matrix(0, -1, 1, 0, 0, 0)"); // rotate(-90deg), animated
  await expect(head(p).locator("span").last()).toHaveText("—");
  expect(await style(head(p).locator("span").last(), "fontWeight")).toBe("400");
  await expect(p.getByText("No Apple Watch data synced")).toHaveCount(0);
  expect(w.errs).toEqual([]);

  // while the listener is still loading: "loading…", zero rows rather than the empty note
  await start(p, { __getDocDelays: { [P(`apple_activity/${DATE}`)]: 1500 } });
  await expect(card(p)).toContainText("loading…");
  expect((await rows(p))[1]).toEqual(["Steps", "0", "0"]);
  await expect(p.getByText("No Apple Watch data synced")).toHaveCount(0);
  await expect(p.getByText("No Apple Watch data synced")).toBeVisible({ timeout: 4000 });
  await expect(card(p)).not.toContainText("loading…");
});

test("synced slots: table, kcal at the calculator's weight, synced time, summary, report", async ({
  page: p,
}) => {
  const w = watch(p);
  await start(p, {
    __docs: {
      ...CALC,
      [P(`apple_activity/${DATE}`)]: {
        slots: { 1000: [1000, 10, 2] },
        updated_at: `${DATE}T09:07:30.000Z`,
      },
    },
  });
  await expect(card(p)).toContainText("synced 10:07"); // local time
  expect(await rows(p)).toEqual([
    ["", "Count", "kcal"],
    ["Steps", "1,000", "40"],
    ["Active minutes", "10 min", "18"],
    ["Flights climbed", "2", "4"],
    ["Total", "", "61"],
  ]);
  const th = card(p).locator("th").nth(1);
  expect(await style(th, "textTransform")).toBe("uppercase");
  expect(await style(th, "textAlign")).toBe("right");
  expect(await style(card(p).locator("th").first(), "textAlign")).toBe("left");
  const total = card(p).locator("tr").last();
  expect(await style(total.locator("td").last(), "fontWeight")).toBe("500");
  expect(await style(total.locator("td").last(), "borderBottomStyle")).toBe("none");
  expect(await style(card(p).locator("tr").nth(1).locator("td").last(), "color")).toBe(
    "rgb(24, 95, 165)",
  );
  await expect(card(p)).not.toContainText("Excludes");
  expect(await burned(p)).toBe("61"); // reported up to the day's net kcal
  await title(p).click();
  await expect(head(p).locator("span").last()).toHaveText("1,000 steps · 61 kcal");
  expect(await style(head(p).locator("span").last(), "fontWeight")).toBe("500");
  expect(await burned(p)).toBe("61"); // still counted while collapsed
  expect(w.errs).toEqual([]);
});

test("Polar sessions linked from the day are excluded from 5-min slots", async ({ page: p }) => {
  await start(p, {
    __days: [day([{ id: "f", name: "Toast", kcal: 80 }, polarItem("s1"), polarItem("missing")])],
    __docs: {
      ...CALC,
      [P("polar_sessions/s1")]: run("08:02", 30),
      [P(`apple_activity/${DATE}`)]: {
        slots: { "0800": [100, 2, 1], "0805": [50, 1, 0], 1000: [1000, 10, 2] },
      },
    },
  });
  await expect(card(p)).toContainText(
    "Excludes 110 steps · 2 min · 1 flights during Polar sessions",
  );
  await expect(card(p)).not.toContainText("(estimated)");
  expect(await rows(p)).toEqual([
    ["", "Count", "kcal"],
    ["Steps", "1,040", "41"],
    ["Active minutes", "11 min", "19"],
    ["Flights climbed", "2", "5"],
    ["Total", "", "65"],
  ]);
  expect(
    await p.evaluate(() => window.__getDocPaths.filter((x) => x.includes("polar_sessions"))),
  ).toEqual(["users/u/polar_sessions/s1", "users/u/polar_sessions/missing"]);
  const note = p.getByText("during Polar sessions");
  expect(await style(note, "borderTopStyle")).toBe("solid");
  expect(await style(note, "fontSize")).toBe("10px");

  // minutes alone (no steps or flights) still make the note
  await start(p, {
    __days: [day([polarItem("s1")])],
    __docs: {
      ...CALC,
      [P("polar_sessions/s1")]: run("08:00", 10),
      [P(`apple_activity/${DATE}`)]: { slots: { "0800": [0, 3, 0], 1000: [10, 0, 0] } },
    },
  });
  await expect(card(p)).toContainText("Excludes 0 steps · 3 min · 0 flights");
});

test("daily totals: estimated exclusions by sport cadence; none without sessions", async ({
  page: p,
}) => {
  await start(p, {
    __days: [day([polarItem("s2"), polarItem("gone")])], // a missing session is skipped
    __docs: {
      ...CALC,
      [P("polar_sessions/s2")]: run("08:00", 20),
      [P(`apple_activity/${DATE}`)]: {
        mode: "daily",
        totals: { steps: 5000, activeMin: 30, flights: 3 },
      },
    },
  });
  await expect(card(p)).toContainText(
    "Excludes 3,200 steps · 20 min · 0 flights during Polar sessions (estimated)",
  );
  expect((await rows(p)).slice(1)).toEqual([
    ["Steps", "1,800", "72"],
    ["Active minutes", "10 min", "18"],
    ["Flights climbed", "3", "6"],
    ["Total", "", "95"],
  ]);
  expect(await burned(p, 600)).toBe("95"); // two Polar sessions of 300 kcal

  await start(p, {
    __docs: {
      ...CALC,
      [P(`apple_activity/${DATE}`)]: { totals: { steps: 5000, activeMin: 30, flights: 3 } },
    },
  });
  await expect(card(p)).not.toContainText("Excludes");
  expect((await rows(p)).slice(1)).toEqual([
    ["Steps", "5,000", "200"],
    ["Active minutes", "30 min", "53"],
    ["Flights climbed", "3", "6"],
    ["Total", "", "258"],
  ]);
  // an empty slots map falls back to the totals; a doc with neither is "no data"
  await start(p, {
    __docs: { ...CALC, [P(`apple_activity/${DATE}`)]: { slots: {}, totals: { steps: 100 } } },
  });
  expect((await rows(p))[1]).toEqual(["Steps", "100", "4"]);
  await start(p, {
    __docs: {
      ...CALC,
      [P(`apple_activity/${DATE}`)]: { slots: {}, updated_at: `${DATE}T08:00:00Z` },
    },
  });
  await expect(p.getByText("No Apple Watch data synced for this day yet")).toBeVisible();
  await expect(card(p)).toContainText("synced 09:00");
  expect(await burned(p)).toBe("0");
});

test("a failed listener logs, shows no data and reports 0; a failed session load logs", async ({
  page: p,
}) => {
  const w = watch(p);
  await start(p, {
    __failPaths: [P(`apple_activity/${DATE}`)],
    __docs: { ...CALC, [P(`apple_activity/${DATE}`)]: { slots: { 1000: [1000, 10, 2] } } },
  });
  await expect(p.getByText("No Apple Watch data synced for this day yet")).toBeVisible();
  expect(w.logged.some((l) => l.startsWith("apple_activity listen failed:"))).toBe(true);
  expect(await burned(p)).toBe("0");

  await start(p, {
    __days: [day([polarItem("s1")])],
    __failPaths: [P("polar_sessions/s1")],
    __docs: {
      ...CALC,
      [P("polar_sessions/s1")]: run("08:02", 30),
      [P(`apple_activity/${DATE}`)]: { slots: { "0800": [100, 2, 1] } },
    },
  });
  await expect
    .poll(() => w.logged.some((l) => l.startsWith("polar sessions load failed:")))
    .toBe(true);
  expect((await rows(p))[1]).toEqual(["Steps", "100", "4"]); // nothing excluded
  expect(w.errs).toEqual([]);
});

test("switching day: the previous day's data and Polar sessions don't linger", async ({
  page: p,
}) => {
  const day3 = { ...day(), date: "2026-10-03" };
  await start(p, {
    __days: [day([polarItem("s1")]), day3],
    __failPaths: [P("apple_activity/2026-10-02")],
    __docs: {
      ...CALC,
      [P("polar_sessions/s1")]: run("08:02", 30),
      [P(`apple_activity/${DATE}`)]: { slots: { "0800": [100, 2, 1] } },
      [P("apple_activity/2026-10-03")]: { slots: { "0800": [100, 2, 1] } },
      [P("apple_activity/2026-10-02")]: { slots: { "0800": [100, 2, 1] } },
    },
  });
  await expect(card(p)).toContainText("Excludes 60 steps · 1 min · 1 flights"); // 08:02–08:05
  await clickDay(p, 3); // same slots, no Polar entries: nothing excluded
  await expect(card(p)).not.toContainText("Excludes");
  expect((await rows(p))[1]).toEqual(["Steps", "100", "4"]);
  await clickDay(p, 2); // its listener fails: no data, not the day before's
  await expect(p.getByText("No Apple Watch data synced for this day yet")).toBeVisible();
});
