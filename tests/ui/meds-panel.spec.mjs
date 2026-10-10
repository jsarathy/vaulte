// tests/ui/meds-panel.spec.mjs — the Meds panel in the Daily log sidebar (Fix 26 PR 15): meds for
// the day, filled count, loading, typing and saving on leaving a field, and switching days.
import { test, expect } from "./cover.mjs";

const PATH = (d) => `users/u/routine_log/${d}`;
const DOCS = {
  [PATH("2026-10-01")]: {
    entries: {
      thyronorm: { text: "7:05" },
      esomeprazole: { done: true },
      probiotic: { text: "  " },
    },
  },
  [PATH("2026-10-04")]: {
    entries: Object.fromEntries(
      ["thyronorm", "esomeprazole", "probiotic", "statin", "vit_d"].map((id) => [id, { text: id }]),
    ),
  },
  [PATH("2026-10-05")]: {},
};
const WEEKDAY_MEDS = [
  "Thyronorm",
  "Esomeprazole",
  " Vits / Aspirin",
  "Statin / Amlodipine/ Allergy",
];

test("meds panel", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const logged = [];
  p.on("console", (m) => m.type() === "error" && logged.push(m.text()));
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((docs) => {
    window.__docs = docs;
    window.__getDocDelays = {
      "users/u/routine_log/2026-10-01": 1200, // long enough to see "Loading…" on a busy machine
      "users/u/routine_log/2026-10-05": 1800,
    };
  }, DOCS);
  await p.goto("/tracker.html");
  const ev = (f, a) => p.evaluate(f, a);
  const panel = p.getByText("Meds", { exact: true }).locator("../..");
  const inputs = panel.locator("input");
  const count = panel.getByText(/^\d+\/\d+$/);
  const css = (loc, k) => loc.evaluate((e, key) => getComputedStyle(e)[key], k);
  const values = () => inputs.evaluateAll((es) => es.map((e) => e.value));
  const names = () =>
    panel
      .locator("input")
      .evaluateAll((es) => es.map((e) => e.previousElementSibling.firstElementChild.textContent));
  const day = (d) =>
    ev((n) => {
      const cell = [...document.querySelectorAll("div[title]")].find(
        (el) => el.childNodes[0]?.nodeValue === String(n) && el.style.fontFamily,
      );
      cell.click();
    }, d);
  const saves = () => ev(() => window.__setDocs.filter((s) => s.path.includes("routine_log")));

  // Loading, then the weekday meds with their times; legacy "done" counts, blank text doesn't
  await expect(panel.getByText("Loading…")).toBeVisible();
  await expect(inputs).toHaveCount(4);
  await expect(panel.getByText("Loading…")).toHaveCount(0);
  expect(await names()).toEqual(WEEKDAY_MEDS);
  for (const t of ["07:00", "11:45", "12:00", "19:30"])
    await expect(panel.getByText(t)).toBeVisible();
  expect(await values()).toEqual(["7:05", "", "  ", ""]);
  await expect(count).toHaveText("2/4");
  expect(await css(count, "color")).toBe("rgb(156, 163, 175)");
  expect(await css(inputs.nth(0), "backgroundColor")).toBe("rgb(241, 248, 242)");
  expect(await css(inputs.nth(0), "borderTopColor")).toBe("rgb(46, 125, 50)");
  expect(await css(inputs.nth(2), "backgroundColor")).toBe("rgb(249, 250, 251)");
  expect(await css(inputs.nth(2), "borderTopColor")).toBe("rgb(229, 231, 235)");
  const label = (i) => inputs.nth(i).locator("xpath=preceding-sibling::div[1]/span[1]");
  expect(await css(label(0), "color")).toBe("rgb(17, 24, 39)");
  expect(await css(label(2), "color")).toBe("rgb(156, 163, 175)");
  expect(await inputs.nth(0).getAttribute("placeholder")).toBe("—");

  // Typing updates the count; leaving the field saves the whole day (merged into the doc)
  await inputs.nth(3).fill("8pm");
  await expect(count).toHaveText("3/4");
  expect(await saves()).toEqual([]);
  await inputs.nth(3).blur();
  await expect.poll(saves).toHaveLength(1);
  const now = await ev(() => new Date().toISOString());
  expect((await saves())[0]).toEqual({
    path: PATH("2026-10-01"),
    data: {
      entries: {
        thyronorm: { text: "7:05" },
        esomeprazole: { done: true },
        probiotic: { text: "  " },
        statin: { text: "8pm" },
      },
      date: "2026-10-01",
      updatedAt: now,
    },
    merge: true,
  });
  await inputs.nth(0).fill("");
  await expect(count).toHaveText("2/4");
  await inputs.nth(1).fill("ok"); // a typed entry replaces the old "done"
  await inputs.nth(1).blur();
  await expect.poll(saves).toHaveLength(3); // each field saves as it's left
  expect((await saves())[1].data.entries.thyronorm).toEqual({ text: "" });
  expect((await saves())[2].data.entries.esomeprazole).toEqual({ text: "ok" });

  // Sunday adds Vit D (no time); all filled → green count
  await day(4);
  await expect(inputs).toHaveCount(5);
  expect((await names()).at(-1)).toBe("Vit D");
  expect(
    await panel
      .locator("input")
      .nth(4)
      .evaluate((e) => e.previousElementSibling.children.length),
  ).toBe(1);
  await expect(count).toHaveText("5/5");
  expect(await css(count, "color")).toBe("rgb(46, 125, 50)");

  // A slow earlier load doesn't overwrite the day picked after it
  await day(1);
  await expect(panel.getByText("Loading…")).toBeVisible();
  await day(5);
  await p.waitForTimeout(1300); // the earlier load has finished; the new one is still running
  await expect(panel.getByText("Loading…")).toBeVisible();
  await expect(count).toHaveText("0/4");
  await p.waitForTimeout(500);
  await expect(count).toHaveText("0/4");
  expect(await values()).toEqual(["", "", "", ""]);
  await expect(panel.getByText("Loading…")).toHaveCount(0);
  await day(2); // no document yet
  await expect(count).toHaveText("0/4");

  // Load and save failures are logged; the panel still works
  await ev(() => (window.__failGetDoc = true));
  await day(3);
  await expect.poll(() => logged.some((l) => l.startsWith("Meds load error:"))).toBe(true);
  await expect(panel.getByText("Loading…")).toHaveCount(0);
  await expect(count).toHaveText("0/4");
  await ev(() => (window.__failSetDoc = true));
  await inputs.nth(0).fill("x");
  await inputs.nth(0).blur();
  await expect.poll(() => logged.some((l) => l.startsWith("Meds save error:"))).toBe(true);

  // nothing is read before the tracker has picked a day
  expect((await ev(() => window.__getDocPaths)).filter((x) => x.endsWith("/null"))).toEqual([]);
  expect(logged.filter((l) => !l.startsWith("Meds "))).toEqual([]); // e.g. no React warnings
  expect(errs).toEqual([]);
});

test("meds panel before any day exists", async ({ page: p }) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.addInitScript(() => (window.__days = []));
  await p.goto("/tracker.html");
  const panel = p.getByText("Meds", { exact: true }).locator("../..");
  await expect(panel.getByText("Loading…")).toBeVisible();
  await p.waitForTimeout(300);
  await expect(panel.getByText("Loading…")).toBeVisible();
  expect(await p.evaluate(() => window.__getDocPaths || [])).not.toContainEqual(
    expect.stringContaining("routine_log"),
  );
});
