// tests/ui/body-trajectory.spec.mjs — the Body tab's Trajectory chart (Fix 26 PR 30): measurement
// pills (and their notes, expanded only), legend, empty state, the drawing (compact and expanded,
// pinned to tests/ui/fixtures/body-trajectory.json), expanding / collapsing, scrolling to the
// latest reading, re-fitting on resize, and the expanded view's hover label.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test
// body-trajectory --workers=1 (then review the JSON diff).
import { test, expect } from "./cover.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/body-trajectory.json", import.meta.url);
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

// ~7 weeks of tape readings, every 4th day missed; hip on every other row only, neck flat
const iso = (i) => new Date(Date.UTC(2026, 7, 17 + i)).toISOString().slice(0, 10);
const ROWS = Array.from({ length: 50 }, (_, i) => i)
  .filter((i) => i % 4 !== 3)
  .map((i) => ({
    id: iso(i),
    waist: +(104 - 0.18 * i + (((i * 7) % 5) - 2) * 0.3).toFixed(1),
    chest: +(110 - 0.05 * i).toFixed(2),
    neck: 41,
    calfL: +(39.2 + (i % 3) * 0.05).toFixed(2), // a narrow range: fine gridlines
    ...(i % 2 ? {} : { hip: +(108 - 0.1 * i).toFixed(1) }),
  }));
const MEASURES = ["Neck", "Shoulder", "L-Bicep", "R-Bicep", "Chest", "Waist", "Abdomen"].concat([
  "Hip",
  "L-Thigh",
  "R-Thigh",
  "L-Calf",
  "R-Calf",
]);

const start = async (p, rows, size) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  if (size) await p.setViewportSize(size);
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), {
    __collections: { [P("body_log")]: rows },
    __docs: {},
  });
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Body", exact: true }).click();
  await p.getByText("📏 Body Log").waitFor();
};
const errors = (p) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

const chartSvg = (p) => p.locator('svg[preserveAspectRatio="xMidYMid meet"]');
const frame = (p) => p.locator('div[title*="Double-click"]');
const heading = (p) => p.getByText("📉 Trajectory");
const pills = (p) => heading(p).locator("xpath=following-sibling::div[1]").locator("button");
const pill = (p, name) => pills(p).filter({ hasText: new RegExp(`^${name}$`) });
const note = (p, name) => pill(p, name).locator("xpath=following-sibling::div[1]");

const shape = (p) =>
  chartSvg(p).evaluate((svg) => {
    const ATTRS = [
      ...["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "width", "height", "d"],
      ...["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linejoin", "opacity"],
      ...["font-size", "font-weight", "text-anchor", "transform", "style"],
    ];
    const node = (el) =>
      [
        el.tagName,
        ...ATTRS.filter((a) => el.hasAttribute(a)).map((a) => `${a}=${el.getAttribute(a)}`),
        ...(el.tagName === "text" ? [`"${el.textContent}"`] : []),
      ].join(" | ");
    const scroller = svg.parentElement;
    const legend = scroller.previousElementSibling.previousElementSibling;
    return {
      svg: {
        width: svg.getAttribute("width"),
        height: svg.getAttribute("height"),
        viewBox: svg.getAttribute("viewBox"),
        style: svg.getAttribute("style"),
      },
      scroller: { className: scroller.className, style: scroller.getAttribute("style") },
      frame: scroller.closest("div[title]").getAttribute("style"),
      legend: legend.outerHTML,
      style: scroller.previousElementSibling.textContent.replace(/\s+/g, " "),
      nodes: [...svg.querySelectorAll("*")].map(node),
    };
  });
const hoverReading = async (p, n) => {
  const hits = chartSvg(p).locator('circle[fill="transparent"]');
  await (n < 0 ? hits.last() : hits.nth(n)).dispatchEvent("mouseover");
};

test("measurement pills: all twelve, Waist first chosen; notes only when expanded", async ({
  page: p,
}) => {
  const errs = errors(p);
  await start(p, ROWS);
  expect(await pills(p).allTextContents()).toEqual(MEASURES);
  const look = (name) =>
    pill(p, name).evaluate((b) => ({ bg: b.style.background, color: b.style.color }));
  expect(await look("Waist")).toEqual({ bg: "rgb(24, 95, 165)", color: "rgb(255, 255, 255)" });
  expect(await look("Hip")).toEqual({ bg: "rgb(247, 250, 253)", color: "rgb(107, 114, 128)" });
  expect(await pill(p, "Neck").getAttribute("style")).toBe(
    "border: 0.5px solid rgb(207, 224, 240); border-radius: 999px; cursor: pointer; padding: 3px 12px; font-size: 11px; font-weight: bold; background: rgb(247, 250, 253); color: rgb(107, 114, 128);",
  );
  expect(await heading(p).getAttribute("style")).toBe(
    "font-size: 15px; font-weight: bold; color: rgb(24, 95, 165); white-space: nowrap;",
  );
  await pill(p, "Hip").click();
  expect(await look("Hip")).toEqual({ bg: "rgb(24, 95, 165)", color: "rgb(255, 255, 255)" });
  expect(await look("Waist")).toEqual({ bg: "rgb(247, 250, 253)", color: "rgb(107, 114, 128)" });
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand"); // click ≠ expand
  // compact: hovering shows no note
  await pill(p, "Chest").hover();
  await expect(note(p, "Chest")).toHaveCount(0);
  await pill(p, "Chest").dblclick(); // not a toggle
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");

  await frame(p).dblclick({ position: { x: 150, y: 150 } });
  await expect(frame(p)).toHaveAttribute("title", "Double-click or press Esc to collapse");
  await pill(p, "Chest").dblclick(); // inside the panel now: still not a toggle
  await expect(frame(p)).toHaveAttribute("title", "Double-click or press Esc to collapse");
  await pill(p, "Chest").hover();
  await expect(note(p, "Chest")).toHaveText(
    "Chest (cm)Around the fullest part of the chest at nipple level, tape under the armpits and level across the back. Read it after a normal breath out.",
  );
  expect(await note(p, "Chest").getAttribute("style")).toBe(
    "position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 40; width: 260px; max-width: 80vw; background: rgb(31, 41, 55); color: rgb(255, 255, 255); border-radius: 6px; padding: 8px 10px; text-align: left; font-size: 11.5px; line-height: 1.45; font-weight: normal; box-shadow: rgba(0, 0, 0, 0.22) 0px 4px 14px; pointer-events: none;",
  );
  await pill(p, "L-Calf").hover();
  await expect(note(p, "Chest")).toHaveCount(0);
  await expect(note(p, "L-Calf")).toHaveText(/^L-Calf \(cm\)Left calf at its widest point/);
  await p.mouse.move(5, 5);
  await expect(note(p, "L-Calf")).toHaveCount(0);
  await pill(p, "Neck").focus();
  await expect(note(p, "Neck")).toHaveText(/^Neck \(cm\)Wrap the tape/);
  await pill(p, "Neck").blur();
  await expect(note(p, "Neck")).toHaveCount(0);
  expect(errs).toEqual([]);
});

test("empty state: fewer than two readings of the chosen site", async ({ page: p }) => {
  const errs = errors(p);
  await start(p, [
    { id: "2026-09-01", waist: 100, hip: 108 },
    { id: "bad-date", waist: 99 },
  ]);
  const msg = p.getByText("Needs at least two Waist readings", { exact: true });
  await expect(msg).toBeVisible();
  expect(await msg.getAttribute("style")).toBe(
    "height: 200px; display: flex; align-items: center; justify-content: center; color: rgb(156, 163, 175); font-size: 12px;",
  );
  await expect(chartSvg(p)).toHaveCount(0);
  await pill(p, "R-Thigh").click();
  await expect(p.getByText("Needs at least two R-Thigh readings", { exact: true })).toBeVisible();
  await frame(p).dblclick();
  expect(
    await p.getByText("Needs at least two R-Thigh readings").evaluate((d) => d.style.height),
  ).toBe("70dvh");
  await p.keyboard.press("Escape");
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  expect(errs).toEqual([]);
});

test("compact drawings", async ({ page: p }) => {
  const errs = errors(p);
  await start(p, ROWS);
  const s = await shape(p);
  expect(s.svg.viewBox).toBe("0 0 380 230");
  expect(s.nodes.filter((n) => n.startsWith("circle")).length).toBe(ROWS.length);
  expect(s.nodes.some((n) => n.endsWith('"cm"'))).toBe(true);
  matchGolden("waist-compact", s);
  for (const name of ["Hip", "Neck", "L-Calf", "Chest"]) {
    await pill(p, name).click();
    matchGolden(`${name}-compact`, await shape(p));
  }
  // two readings on the same day: one point in time
  await start(p, [
    { id: "2026-09-01", waist: 100 },
    { id: "2026-09-01T00:00:00Z", waist: 99 },
  ]);
  matchGolden("same-day", await shape(p));
  expect(errs).toEqual([]);
});

test("expand, scroll to the latest reading, hover, collapse", async ({ page: p }) => {
  const errs = errors(p);
  const LATE = { id: "2027-03-01", waist: 95.5, hip: 101 };
  await start(p, [...ROWS, LATE]);
  await frame(p).dblclick({ position: { x: 150, y: 150 } });
  await expect(p.getByText("Esc or double-click to collapse")).toBeVisible();
  await expect(heading(p)).toHaveCount(1); // the heading moves into the panel
  expect(await heading(p).getAttribute("style")).toBe(
    "font-size: 16px; font-weight: bold; color: rgb(24, 95, 165); white-space: nowrap;",
  );
  const scroll = () =>
    chartSvg(p).evaluate((svg) => {
      const el = svg.parentElement;
      const dots = [...svg.querySelectorAll('circle[fill="#378ADD"]')];
      const lastX = Number(dots[dots.length - 1].getAttribute("cx"));
      const most = el.scrollWidth - el.clientWidth; // the latest reading is at the far end
      return {
        left: el.scrollLeft,
        want: Math.round(Math.min(most, Math.max(0, lastX - el.clientWidth * 0.75))),
      };
    });
  await expect.poll(async () => (await scroll()).left).toBeGreaterThan(0);
  const sc = await scroll();
  expect(Math.abs(sc.left - sc.want)).toBeLessThanOrEqual(1);
  matchGolden("waist-expanded", await shape(p));

  await hoverReading(p, 10);
  const label = chartSvg(p).locator("g[style] > text");
  const r = ROWS[10];
  await expect(label).toHaveText(
    `${r.id.split("-").reverse().join("/")} · ${r.waist.toFixed(1)} cm`,
  );
  matchGolden("waist-expanded-hover", await shape(p));
  await chartSvg(p).locator('circle[fill="transparent"]').nth(10).dispatchEvent("mouseout");
  await expect(chartSvg(p).locator("g[style] rect")).toHaveCount(0);
  await hoverReading(p, 4);
  // switching site re-scrolls and drops the hovered waist reading's label (Fix 36)
  await chartSvg(p).evaluate((svg) => (svg.parentElement.scrollLeft = 0));
  await pill(p, "Hip").click();
  await expect(chartSvg(p).locator("g[style] > text")).toHaveCount(0);
  await expect(chartSvg(p).locator("g[style] rect")).toHaveCount(0);
  await expect.poll(async () => (await scroll()).left).toBeGreaterThan(0);
  matchGolden("hip-expanded", await shape(p));
  await hoverReading(p, -1);
  await expect(chartSvg(p).locator("g[style] > text")).toHaveText("01/03/2027 · 101.0 cm");
  matchGolden("hip-expanded-hover-last", await shape(p));

  await p.keyboard.press("Escape");
  await expect(frame(p)).toHaveAttribute("title", "Double-click to expand");
  const radii = await chartSvg(p)
    .locator('circle[fill="#378ADD"]')
    .evaluateAll((cs) => [...new Set(cs.map((c) => c.getAttribute("r")))]);
  expect(radii).toHaveLength(1);
  await frame(p).dblclick({ position: { x: 150, y: 150 } });
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
  await start(p, ROWS);
  await frame(p).dblclick({ position: { x: 150, y: 150 } });
  const size = () =>
    chartSvg(p).evaluate((svg) => ({
      h: Number(svg.getAttribute("height")),
      box: svg.parentElement.clientHeight,
    }));
  await expect.poll(async () => (await size()).h).toBe((await size()).box - 22);
  await p.setViewportSize({ width: 1400, height: 400 });
  await expect.poll(async () => (await size()).h).toBe(300);
  await p.setViewportSize({ width: 1400, height: 700 });
  await expect.poll(async () => (await size()).h).toBe((await size()).box - 22);
  await p.setViewportSize({ width: 1400, height: 400 });
  await expect.poll(async () => (await size()).h).toBe(300);
  // the third waist reading is the highest: its label sits below it
  await hoverReading(p, 2);
  const place = () =>
    chartSvg(p).evaluate((svg) => ({
      dot: Number(svg.querySelectorAll('circle[fill="#378ADD"]')[2].getAttribute("cy")),
      label: Number(svg.querySelector("g[style] rect").getAttribute("y")),
    }));
  const { dot, label } = await place();
  expect(label).toBeGreaterThan(dot);
  matchGolden("waist-hover-top", await shape(p));
  expect(errs).toEqual([]);
});
