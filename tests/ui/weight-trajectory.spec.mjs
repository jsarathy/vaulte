// tests/ui/weight-trajectory.spec.mjs — the Weight tab's Trajectory chart (Fix 26 PR 21): metric
// tabs and their hover notes, legend, empty states, the drawing (compact and expanded, pinned to
// tests/ui/fixtures/weight-trajectory.json), expanding / collapsing, scrolling to the latest
// reading, re-fitting on resize, and the expanded view's hover label.
// Re-record the drawings only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test
// weight-trajectory (then review the JSON diff).
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/weight-trajectory.json", import.meta.url);
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

// ~6 weeks of readings from the plan start, every 5th day missed; Renpho fields on 2 rows in 3
const iso = (i) => new Date(Date.UTC(2026, 7, 17 + i)).toISOString().slice(0, 10);
const READINGS = Array.from({ length: 48 }, (_, i) => i)
  .filter((i) => i % 5 !== 4)
  .map((i) => {
    const actual = +(84 - 0.12 * i + (((i * 7) % 5) - 2) * 0.15).toFixed(2);
    const renpho = {
      bmi: +(actual / 1.65 ** 2).toFixed(1),
      bodyfat: +(30 - 0.05 * i).toFixed(2),
      muscleMass: +(55 + 0.01 * i).toFixed(2),
      visfat: i > 20 ? 11 : 12,
      Weight: actual, // hidden (any case)
      fc: 1,
      isauto: 1,
      custom_score_v2: i, // unknown keys: split into words
      fatMassIndex: 9.1,
      water: 55, // "Body water": sorted by name, not key
      bodyAge: 58, // note found by the lower-case key
    };
    return { id: iso(i), actual, ...(i % 3 === 2 ? {} : { renpho }) };
  });
const NO_ACTUAL = { id: "2026-10-10", dose: "5mg" }; // planned row, no reading

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
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
};
const withLog = (rows, plan) => ({
  __collections: { [P("weight_log")]: rows },
  __docs: plan ? { [P("weight_plan/settings")]: plan } : {}, // init scripts pile up across start()s
});
const errors = (p) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

const chartSvg = (p) => p.locator('svg[preserveAspectRatio="xMidYMid meet"]');
const frame = (p) => p.locator('div[title*="Double-click"]');
const pills = (p) =>
  p.getByText("📉 Trajectory").locator("xpath=following-sibling::div[1]").locator("button");
const pill = (p, name) => pills(p).filter({ hasText: new RegExp(`^${name}$`) });

// Everything the chart draws, attribute by attribute, plus its frame and scroller
const shape = (p) =>
  chartSvg(p).evaluate((svg) => {
    const ATTRS = [
      ...["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "width", "height", "d"],
      ...["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linejoin", "opacity"],
      ...["font-size", "font-weight", "text-anchor", "transform", "style"],
    ];
    // one line per element: tag, then each attribute it has, then any text
    const node = (el) =>
      [
        el.tagName,
        ...ATTRS.filter((a) => el.hasAttribute(a)).map((a) => `${a}=${el.getAttribute(a)}`),
        ...(el.tagName === "text" ? [`"${el.textContent}"`] : []),
      ].join(" | ");
    const scroller = svg.parentElement;
    return {
      svg: {
        width: svg.getAttribute("width"),
        height: svg.getAttribute("height"),
        viewBox: svg.getAttribute("viewBox"),
        style: svg.getAttribute("style"),
      },
      scroller: { className: scroller.className, style: scroller.getAttribute("style") },
      frame: scroller.closest("div[title]").getAttribute("style"),
      nodes: [...svg.querySelectorAll("*")].map(node),
    };
  });
const legend = (p) =>
  chartSvg(p)
    .locator("xpath=../preceding-sibling::div[1]")
    .evaluate((d) => ({
      items: [...d.children].map((s) => s.textContent.trim()),
      fontSize: d.style.fontSize,
    }));
// Hover a reading in the expanded view by its index (the invisible hit circle on top of it)
const hoverReading = async (p, n) => {
  const hits = chartSvg(p).locator('circle[fill="transparent"]');
  await (n < 0 ? hits.last() : hits.nth(n)).dispatchEvent("mouseover"); // React builds mouseenter from mouseover
};

test("metric tabs: Weight first, Renpho metrics by name, hidden fields left out", async ({
  page: p,
}) => {
  const errs = errors(p);
  await start(p, withLog([...READINGS, NO_ACTUAL]));
  expect(await pills(p).allTextContents()).toEqual([
    "Weight",
    "BMI",
    "Body fat",
    "Body water",
    "Custom score v2",
    "Fat Mass Index",
    "Metabolic age",
    "Muscle mass",
    "Visceral fat",
  ]);
  const look = (name) =>
    pill(p, name).evaluate((b) => ({ bg: b.style.background, color: b.style.color }));
  expect(await look("Weight")).toEqual({ bg: "rgb(24, 95, 165)", color: "rgb(255, 255, 255)" });
  expect(await look("BMI")).toEqual({ bg: "rgb(247, 250, 253)", color: "rgb(107, 114, 128)" });
  await pill(p, "BMI").click();
  expect(await look("BMI")).toEqual({ bg: "rgb(24, 95, 165)", color: "rgb(255, 255, 255)" });
  expect(await look("Weight")).toEqual({ bg: "rgb(247, 250, 253)", color: "rgb(107, 114, 128)" });
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand"); // click ≠ expand

  // Hover notes: name, unit, explanation (lower-case lookup, then a generic fallback)
  const note = (name) => pill(p, name).locator("xpath=following-sibling::div[1]");
  const notes = {
    Weight:
      "Weight (kg)Total body weight, from the Renpho scale. The dashed line is your planned trajectory.",
    BMI: "BMIBody Mass Index: weight relative to height. A rough screening number — it can't tell fat from muscle.",
    "Body fat":
      "Body fat (%)Share of your body weight that is fat. Renpho estimates it from bioelectrical impedance, so absolute values are approximate; the trend is what matters.",
    "Custom score v2": "Custom score v2Custom score v2, as reported by your Renpho scale.",
    "Metabolic age":
      "Metabolic age (yrs)Metabolic age: the age your body composition resembles. Lower than your real age is the goal.",
    "Fat Mass Index": "Fat Mass IndexFat Mass Index, as reported by your Renpho scale.",
    "Muscle mass": "Muscle mass (kg)Muscle mass, as reported by your Renpho scale.",
    "Visceral fat":
      "Visceral fatVisceral fat: the fat around your organs, on Renpho's 1-59 scale. Under 10 is considered healthy, and it's the fat most linked to metabolic risk.",
  };
  for (const [name, text] of Object.entries(notes)) {
    await pill(p, name).hover();
    await expect(note(name)).toHaveText(text);
    expect(await p.getByText(text.slice(-30)).count()).toBe(1); // only this tab's note
  }
  await p.mouse.move(5, 5);
  await expect(note("Visceral fat")).toHaveCount(0);
  const box = await note("Weight").count();
  expect(box).toBe(0);
  // keyboard focus shows the note too; leaving hides it
  await pill(p, "Body fat").focus();
  await expect(note("Body fat")).toBeVisible();
  const style = await note("Body fat").evaluate((d) => d.getAttribute("style"));
  expect(style).toBe(
    "position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 40; width: 260px; max-width: 80vw; background: rgb(31, 41, 55); color: rgb(255, 255, 255); border-radius: 6px; padding: 8px 10px; text-align: left; font-size: 11.5px; line-height: 1.45; font-weight: normal; box-shadow: rgba(0, 0, 0, 0.22) 0px 4px 14px; pointer-events: none;",
  );
  await pill(p, "Body fat").blur();
  await expect(note("Body fat")).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("empty states", async ({ page: p }) => {
  const errs = errors(p);
  // no plan curve and no readings
  await start(p, withLog([NO_ACTUAL], { planAnchors: [] }));
  const msg = p.getByText(
    "Set a start date, start weight and curve anchors to see the projection",
    { exact: true },
  );
  await expect(msg).toBeVisible();
  expect(await msg.evaluate((d) => d.getAttribute("style"))).toBe(
    "height: 200px; display: flex; align-items: center; justify-content: center; color: rgb(156, 163, 175); font-size: 12px;",
  );
  await expect(chartSvg(p)).toHaveCount(0);
  await frame(p).dblclick();
  expect(await msg.evaluate((d) => d.style.height)).toBe("70dvh");
  await p.keyboard.press("Escape");
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");

  // a Renpho metric with a single reading (plan curve ignored off the Weight tab)
  await start(p, withLog([{ id: "2026-09-01", actual: 83, renpho: { bmi: 30.5 } }]));
  await expect(chartSvg(p)).toHaveCount(1); // weight: the plan curve alone is enough
  await pill(p, "BMI").click();
  await expect(
    p.getByText("Needs at least two readings — sync Renpho to fill this in", { exact: true }),
  ).toBeVisible();
  await expect(chartSvg(p)).toHaveCount(0);

  // one reading and no plan curve: still empty; two readings: drawn
  await start(p, withLog([{ id: "2026-09-01", actual: 83 }], { planAnchors: [] }));
  await expect(chartSvg(p)).toHaveCount(0);
  await start(
    p,
    withLog(
      [
        { id: "2026-09-01", actual: 83 },
        { id: "2026-09-02", actual: 82.6 },
      ],
      { planAnchors: [] },
    ),
  );
  await expect(chartSvg(p)).toHaveCount(1);
  expect(errs).toEqual([]);
});

test("compact drawing: weight with plan, 2-wk avg and target zone; Renpho metrics", async ({
  page: p,
}) => {
  const errs = errors(p);
  await start(p, withLog([...READINGS, NO_ACTUAL]));
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  expect(await legend(p)).toEqual({
    items: ["Projected", "Actual", "2-wk avg"],
    fontSize: "10px",
  });
  const s = await shape(p);
  expect(s.svg).toEqual({
    width: "100%",
    height: null,
    viewBox: "0 0 380 230",
    style: "display: block;",
  });
  const texts = s.nodes.filter((n) => n.startsWith("text")).map((n) => n.split('"')[1]);
  expect(texts).toContain("Target 70–72 kg");
  expect(texts).toContain("kg");
  expect(texts).toContain("17/08/2026");
  expect(s.nodes.filter((n) => n.startsWith("circle")).length).toBe(READINGS.length);
  matchGolden("weight-compact", s);

  for (const name of ["BMI", "Body fat", "Visceral fat", "Custom score v2", "Fat Mass Index"]) {
    await pill(p, name).click();
    expect(await legend(p)).toEqual({ items: ["Projected", "Actual"], fontSize: "10px" });
    matchGolden(`${name}-compact`, await shape(p));
  }
  expect(errs).toEqual([]);
});

test("weight without a plan curve or target", async ({ page: p }) => {
  const errs = errors(p);
  const plan = { planAnchors: [], targetWeightMinKg: null, targetWeightMaxKg: null };
  await start(
    p,
    withLog(
      [
        { id: "2026-09-01", actual: 83.2 },
        { id: "2026-09-07", actual: 82.9 },
        { id: "2026-09-08", actual: 82.7 },
      ],
      plan,
    ),
  );
  expect((await legend(p)).items).toEqual(["Projected", "Actual", "2-wk avg"]);
  matchGolden("weight-no-plan", await shape(p));
  // target zone without a plan curve: the scale reaches 1 kg below the target (69–75 here, so
  // gridlines every 1 kg)
  await start(
    p,
    withLog(
      [
        { id: "2026-09-01", actual: 74 },
        { id: "2026-09-08", actual: 73.5 },
      ],
      { planAnchors: [] },
    ),
  );
  const ys = await shape(p);
  const yLabels = ys.nodes.map((n) => n.split('"')[1]).filter((t) => /^\d+$/.test(t ?? ""));
  expect(yLabels).toEqual(["69", "70", "71", "72", "73", "74", "75"]);
  matchGolden("weight-target-only", ys);
  // plan curve and a single reading: no 2-wk avg line or legend entry
  await start(p, withLog([{ id: "2026-09-01", actual: 83.2 }]));
  expect((await legend(p)).items).toEqual(["Projected", "Actual"]);
  await expect(chartSvg(p).locator('path[stroke="#E65100"]')).toHaveCount(0);
  matchGolden("weight-one-reading", await shape(p));
  expect(errs).toEqual([]);
});

test("expand, scroll to the latest reading, collapse; hover label", async ({ page: p }) => {
  const errs = errors(p);
  const LATE = { id: "2027-03-01", actual: 70.4, renpho: { bmi: 25.9 } }; // well past the screen
  await start(p, withLog([...READINGS, NO_ACTUAL, LATE]));
  // double-clicking the tabs doesn't expand
  await pill(p, "Weight").dblclick();
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  await frame(p).dblclick({ position: { x: 200, y: 120 } });
  await expect(frame(p)).toHaveAttribute("title", "Double-click or press Esc to collapse");
  await expect(p.getByText("Esc or double-click to collapse")).toBeVisible();
  await expect(p.getByText("📉 Trajectory")).toHaveCount(1); // header moves into the panel
  expect(await legend(p)).toEqual({
    items: ["Projected", "Actual", "2-wk avg"],
    fontSize: "12px",
  });
  await pill(p, "Weight").dblclick(); // inside the panel now: still not a toggle
  await expect(frame(p)).toHaveAttribute("title", "Double-click or press Esc to collapse");

  // the latest reading is scrolled into view (three quarters across)
  const scroll = () =>
    chartSvg(p).evaluate((svg) => {
      const el = svg.parentElement;
      const dots = [...svg.querySelectorAll('circle[fill="#378ADD"]')];
      const lastX = Number(dots[dots.length - 1].getAttribute("cx"));
      return { left: el.scrollLeft, want: Math.round(Math.max(0, lastX - el.clientWidth * 0.75)) };
    });
  await expect.poll(async () => (await scroll()).left).toBeGreaterThan(0);
  const sc = await scroll();
  expect(Math.abs(sc.left - sc.want)).toBeLessThanOrEqual(1);
  const s = await shape(p);
  expect(s.svg.height).toBe(String(Number(s.svg.height))); // drawn in real pixels
  matchGolden("weight-expanded", s);

  // hover a reading: bigger dot and a label with the 2-wk average
  await hoverReading(p, 30);
  const label = chartSvg(p).locator("g[style] > text");
  const r = READINGS[30];
  await expect(label).toHaveText(
    new RegExp(
      `^${r.id.split("-").reverse().join("/")} · ${r.actual.toFixed(1)} kg · 2-wk avg \\d+\\.\\d$`,
    ),
  );
  matchGolden("weight-expanded-hover", await shape(p));
  await chartSvg(p).locator('circle[fill="transparent"]').nth(30).dispatchEvent("mouseout");
  await expect(chartSvg(p).locator("g[style] rect")).toHaveCount(0);
  // the first reading's 2-wk avg is itself
  await hoverReading(p, 0);
  await expect(chartSvg(p).locator("g[style] > text")).toHaveText(
    "17/08/2026 · 83.7 kg · 2-wk avg 83.7",
  );
  await chartSvg(p).locator('circle[fill="transparent"]').nth(0).dispatchEvent("mouseout");
  await chartSvg(p).evaluate((svg) => (svg.parentElement.scrollLeft = 0)); // switching re-scrolls
  await pill(p, "BMI").click();
  await expect(frame(p)).toHaveAttribute("title", "Double-click or press Esc to collapse");
  await expect(chartSvg(p).locator("g[style] rect")).toHaveCount(0);
  await expect.poll(async () => (await scroll()).left).toBeGreaterThan(0);
  matchGolden("bmi-expanded", await shape(p));
  await hoverReading(p, 5);
  await expect(chartSvg(p).locator("g[style] > text")).toHaveText(/^\d\d\/\d\d\/2026 · \d+\.\d$/);
  matchGolden("bmi-expanded-hover", await shape(p));

  // Esc collapses; hover state is cleared (no enlarged dot in the compact chart)
  await p.keyboard.press("Escape");
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  expect((await shape(p)).svg.viewBox).toBe("0 0 380 230");
  // the hover is cleared one render after the view changes, so wait for a single radius
  await expect
    .poll(() =>
      chartSvg(p)
        .locator('circle[fill="#378ADD"]')
        .evaluateAll((cs) => new Set(cs.map((c) => c.getAttribute("r"))).size),
    )
    .toBe(1);
  await frame(p).dblclick({ position: { x: 200, y: 120 } });
  await expect(chartSvg(p).locator("g[style] rect")).toHaveCount(0);
  // double-click collapses too; Esc when collapsed does nothing
  await frame(p).dblclick({ position: { x: 300, y: 300 } });
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  await p.keyboard.press("Escape");
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  expect(errs).toEqual([]);
});

test("expanded view re-fits a resized window; label below a point near the top", async ({
  page: p,
}) => {
  const errs = errors(p);
  await start(p, withLog(READINGS));
  await pill(p, "Body fat").click();
  await frame(p).dblclick({ position: { x: 200, y: 120 } });
  const size = () =>
    chartSvg(p).evaluate((svg) => ({
      h: Number(svg.getAttribute("height")),
      box: svg.parentElement.clientHeight,
    }));
  await expect.poll(async () => (await size()).h).toBe((await size()).box - 22);
  await p.setViewportSize({ width: 1400, height: 400 });
  await expect.poll(async () => (await size()).h).toBe(300); // never below 300
  await p.setViewportSize({ width: 1400, height: 700 });
  await expect.poll(async () => (await size()).h).toBe((await size()).box - 22);
  await p.setViewportSize({ width: 1400, height: 400 });
  await expect.poll(async () => (await size()).h).toBe(300);
  // first reading is the highest body fat: its label sits below it
  await hoverReading(p, 0);
  const place = () =>
    chartSvg(p).evaluate((svg) => ({
      dot: Number(svg.querySelectorAll('circle[fill="#378ADD"]')[0].getAttribute("cy")),
      label: Number(svg.querySelector("g[style] rect").getAttribute("y")),
    }));
  const { dot, label } = await place();
  expect(label).toBeGreaterThan(dot);
  matchGolden("bodyfat-short-hover", await shape(p));
  await hoverReading(p, -1);
  matchGolden("bodyfat-short-hover-last", await shape(p));
  expect(errs).toEqual([]);
});
