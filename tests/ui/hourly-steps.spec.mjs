// tests/ui/hourly-steps.spec.mjs — the Add Entry "Steps by hour" card (Fix 26 PR 39): loading,
// empty and drawn states, the step axis, bars and hover, browsing by date, expanding to full screen
// (measured drawing, value labels, every hour labelled) and collapsing with Esc or a double-click.
import { test, expect } from "@playwright/test";

test.use({ timezoneId: "Europe/London" });

const DOC = (date) => `users/u/apple_activity/${date}`;
// 07:00–07:59 is the peak (the first of two); "x" is ignored; hours not listed count as 0
const HOURLY = { "06": 150, "07": 1234, "08": 400, 12: "x", 17: 820, 18: 7, 20: 1234 };
const SUM = 150 + 1234 + 400 + 820 + 7 + 1234;

const start = async (p, init = {}, docs = { [DOC("2026-10-03")]: { hourly: HOURLY } }) => {
  await p.addInitScript(
    ({ i, docs }) => {
      window.__noBackfill = true;
      window.__docs = docs;
      Object.assign(window, { __userId: "u" }, i); // init scripts stack across starts
    },
    { i: init, docs },
  );
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
};
const card = (p) => p.getByText("Steps by hour").locator("../../..");
const chart = (p) =>
  p
    .locator("svg")
    .filter({ has: p.locator("rect") })
    .last();
const style = (loc, prop) => loc.evaluate((e, k) => getComputedStyle(e)[k], prop);
const bars = (p) => chart(p).locator("g > rect:nth-child(2)");
const column = (p, h) =>
  chart(p)
    .locator("g > rect:nth-child(1)")
    .nth(h)
    .hover({ position: { x: 1, y: 1 } });
const texts = (p) => chart(p).locator("text").allTextContents();
const full = (p) => p.locator("div[title='Double-click or press Esc to collapse']");
const expand = (p) => chart(p).dblclick({ position: { x: 5, y: 5 } });

test("loading, empty and drawn states; the card's title bar", async ({ page: p }) => {
  await start(p, { __userId: "" });
  await expect(card(p)).toContainText("loading…");
  await expect(chart(p)).toHaveCount(0);

  await start(p, {}, {});
  const body = p.getByText("No hourly steps synced for this day yet");
  await expect(body).toBeVisible();
  expect(await style(body, "fontStyle")).toBe("italic");
  const pane = body.locator("..");
  expect(await style(pane, "cursor")).toBe("default");
  await expect(pane).not.toHaveAttribute("title");
  await pane.dblclick();
  await expect(full(p)).toHaveCount(0);

  await start(p);
  const head = p.getByText("Steps by hour").locator("..");
  expect(await style(head, "backgroundColor")).toBe("rgb(24, 95, 165)");
  await expect(head).toContainText(/Sat,? 3 Oct 2026/);
  await expect(head.getByLabel("📅 Browse by date")).toBeVisible();
  expect(await style(head.getByText(/Sat,? 3 Oct 2026/), "fontSize")).toBe("11px");
  await expect(card(p)).toContainText(`${SUM.toLocaleString()} steps`);
  await expect(card(p)).toContainText("peak 07:00 · 1,234");
  const pane2 = chart(p).locator("..");
  expect(await style(pane2, "cursor")).toBe("zoom-in");
  await expect(pane2).toHaveAttribute("title", "Double-click to expand");
});

test("drawing: axis, bars, hour labels, hover", async ({ page: p }) => {
  await start(p);
  await expect(chart(p)).toHaveAttribute("viewBox", "0 0 300 130");
  await expect(chart(p)).toHaveAttribute("width", "100%");
  expect(await texts(p)).toEqual([
    ...["0", "500", "1,000", "1,500"],
    ...["00", "03", "06", "09", "12", "15", "18", "21"],
  ]);
  await expect(bars(p)).toHaveCount(24);
  const bar = (h) => bars(p).nth(h);
  const num = async (h, a) => Number(await bar(h).getAttribute(a));
  const cH = 130 - 10 - 18;
  expect(await num(7, "height")).toBeCloseTo((1234 / 1500) * cH, 5);
  expect(await num(7, "y")).toBeCloseTo(10 + cH - (1234 / 1500) * cH, 5);
  expect(await num(18, "height")).toBe(1); // tiny counts still show
  expect(await num(12, "height")).toBe(0); // "x" counts as 0
  expect(await num(0, "x")).toBeCloseTo(34 + (258 / 24) * 0.15, 5);
  expect(await num(0, "width")).toBeCloseTo((258 / 24) * 0.7, 5);
  await expect(bar(7)).toHaveAttribute("fill", "#378ADD");
  await expect(chart(p).locator("line").first()).toHaveAttribute("stroke", "#9ca3af");
  await expect(chart(p).locator("line").nth(1)).toHaveAttribute("stroke", "#eef0f3");

  await column(p, 17);
  await expect(card(p)).toContainText("17:00–18:00 · 820 steps");
  await expect(bar(17)).toHaveAttribute("fill", "#185FA5");
  await column(p, 23);
  await expect(card(p)).toContainText("23:00–00:00 · 0 steps");
  await expect(bar(17)).toHaveAttribute("fill", "#378ADD");
  await p.mouse.move(5, 5);
  await expect(card(p)).toContainText(`${SUM.toLocaleString()} steps`);
  await expect(card(p)).not.toContainText("23:00");
});

test("browse by date: picker, max today, reload; the Add Entry date", async ({ page: p }) => {
  await start(
    p,
    {},
    {
      [DOC("2026-10-03")]: { hourly: HOURLY },
      [DOC("2026-09-30")]: {},
      [DOC("2026-10-01")]: { hourly: { "09": 2100 } },
    },
  );
  const picker = card(p).locator('input[type="date"]');
  await expect(picker).toHaveValue("2026-10-03");
  const today = await p.evaluate(() => new Date().toLocaleDateString("en-CA"));
  await expect(picker).toHaveAttribute("max", today);
  expect(await style(picker, "opacity")).toBe("0");
  await picker.fill("2026-09-30");
  await expect(card(p)).toContainText(/Wed,? 30 Sept? 2026/);
  await expect(card(p)).toContainText("No hourly steps synced");
  await picker.fill("2026-10-01");
  await expect(card(p)).toContainText(/Thu,? 1 Oct 2026/);
  await expect(card(p)).toContainText("2,100 steps");
  expect((await texts(p)).slice(0, 4)).toEqual(["0", "1,000", "2,000", "3,000"]); // ~4 gridlines
  await picker.fill(""); // clearing the picker keeps the day
  await expect(picker).toHaveValue("2026-10-01");
  await expect(card(p)).toContainText(/Thu,? 1 Oct 2026/);
  const addDate = p.locator('input[type="date"]').first(); // Add Entry's own date
  await addDate.fill("2026-10-04");
  await expect(card(p)).toContainText(/Sun,? 4 Oct 2026/);
  await addDate.fill("2026-10-03");
  await expect(card(p)).toContainText(/Sat,? 3 Oct 2026/);
  await expect(card(p)).toContainText("peak 07:00");

  // the button opens the picker (showPicker) and never expands the card
  await p.evaluate(() => {
    HTMLInputElement.prototype.showPicker = function () {
      window.__picked = (window.__picked || 0) + 1;
    };
  });
  const btn = card(p).getByLabel("📅 Browse by date");
  await btn.click();
  await btn.dblclick();
  expect(await p.evaluate(() => window.__picked)).toBe(3);
  await expect(full(p)).toHaveCount(0);
  await p.evaluate(() => {
    HTMLInputElement.prototype.showPicker = () => {
      throw new Error("no");
    };
  });
  await btn.click();
  await expect(picker).toBeFocused();
});

test("expand: full-screen drawing, labels, Esc and double-click collapse", async ({ page: p }) => {
  await start(p);
  await column(p, 7);
  await expect(card(p)).toContainText("07:00–08:00");
  await expand(p);
  await expect(full(p)).toBeVisible();
  expect(await style(full(p), "position")).toBe("fixed");
  expect(await style(full(p), "cursor")).toBe("zoom-out");
  await expect(full(p)).toContainText("⌚ Steps by hour");
  await expect(full(p)).toContainText("Esc or double-click to collapse");
  expect(await style(full(p).getByText("⌚ Steps by hour"), "fontSize")).toBe("24px");
  expect(await style(full(p).getByText(/Sat,? 3 Oct 2026/), "fontSize")).toBe("20px");
  expect(await style(full(p).locator("button"), "fontSize")).toBe("16px");
  await expect(full(p)).not.toContainText("07:00–08:00"); // hover cleared on expand
  await p.mouse.move(0, 0);
  await expect(full(p)).toContainText(`${SUM.toLocaleString()} steps`);
  expect(await style(full(p).getByText("peak 07:00").locator(".."), "fontSize")).toBe("20px");

  // the drawing fills the measured area: width = box, height = box - 4, ≥ 600×300
  const box = await full(p)
    .locator("div[style*='flex: 1']")
    .evaluate((e) => [e.clientWidth, e.clientHeight]);
  expect(box[0]).toBeGreaterThan(600);
  await expect(chart(p)).toHaveAttribute("viewBox", `0 0 ${box[0]} ${box[1] - 4}`);
  await expect(chart(p)).toHaveAttribute("width", String(box[0]));
  await expect(chart(p)).toHaveAttribute("height", String(box[1] - 4));
  const t = await texts(p);
  expect(t.slice(0, 8)).toEqual(["0", "200", "400", "600", "800", "1,000", "1,200", "1,400"]);
  expect(t.slice(8, 14)).toEqual(["150", "1,234", "400", "820", "7", "1,234"]); // over each bar
  expect(t.slice(14)).toEqual(Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")));
  const fs = await chart(p).locator("text").first().getAttribute("font-size");
  expect(Number(fs)).toBeCloseTo(8 * 1.6 * 1.5, 5);
  const top = chart(p).locator("line").last(); // 1,400 gridline sits at the top padding
  expect(Number(await top.getAttribute("y1"))).toBeCloseTo(10 * 1.6 * 1.5, 5);
  expect(Number(await top.getAttribute("x1"))).toBeCloseTo(34 * 1.6 * 1.5, 5);

  await p.evaluate(() => (HTMLInputElement.prototype.showPicker = () => {})); // no native picker
  await full(p).getByLabel("📅 Browse by date").dblclick(); // never collapses
  await expect(full(p)).toBeVisible();
  await column(p, 6);
  await expect(full(p)).toContainText("06:00–07:00 · 150 steps");
  await p.keyboard.press("Escape");
  await expect(full(p)).toHaveCount(0);
  await expect(card(p)).toContainText(`${SUM.toLocaleString()} steps`); // hover cleared on collapse
  await expect(card(p)).not.toContainText("06:00–07:00");
  await expect(chart(p)).toHaveAttribute("viewBox", "0 0 300 130");

  await expand(p);
  await expect(full(p)).toBeVisible();
  await full(p).dblclick({ position: { x: 5, y: 5 } });
  await expect(full(p)).toHaveCount(0);
});

test("expand: re-fits when the window is resized", async ({ page: p }) => {
  await start(p);
  await expand(p);
  await expect(full(p)).toBeVisible();
  await p.setViewportSize({ width: 1000, height: 700 });
  const box = await full(p)
    .locator("div[style*='flex: 1']")
    .evaluate((e) => [e.clientWidth, e.clientHeight]);
  await expect(chart(p)).toHaveAttribute("viewBox", `0 0 ${box[0]} ${box[1] - 4}`);
  await p.setViewportSize({ width: 500, height: 300 });
  await expect(chart(p)).toHaveAttribute("viewBox", /^0 0 600 300$/); // floors
});

test("browse by date: the date input covers the button, so a tap lands on it (Fix 57)", async ({
  page: p,
}) => {
  await start(p);
  const input = card(p).getByLabel("📅 Browse by date");
  const button = card(p).getByText("📅 Browse by date", { exact: true });
  const [i, b] = await Promise.all([input.boundingBox(), button.boundingBox()]);
  expect(i.width).toBeGreaterThanOrEqual(b.width - 1);
  expect(i.height).toBeGreaterThanOrEqual(b.height - 1);
  const hit = await p.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("type"),
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  expect(hit).toBe("date");
});
