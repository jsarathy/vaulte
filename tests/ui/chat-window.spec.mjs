// tests/ui/chat-window.spec.mjs — the chat's floating window (Fix 26 PR 38): where it opens, the
// bubble, dragging by the header, resizing from every edge and corner (clamped to the display and
// the minimum size, remembered in localStorage), re-fitting on a browser resize, the header
// buttons, the message-count line, Enter / Shift+Enter, placeholders and the date / meal bar.
import { test, expect } from "@playwright/test";

const P = (x) => `users/u/${x}`;
const start = async (p, init = {}, viewport) => {
  if (viewport) await p.setViewportSize(viewport);
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
};
const bubble = (p) => p.getByTitle("Nutrition assistant");
const win = (p) => p.getByTitle("Drag to move").locator("..");
const header = (p) => p.getByTitle("Drag to move");
/** The window's placement as the code sets it (inline left / top / width / height; the border is outside). */
const box = async (l) =>
  l.evaluate((el) => {
    const n = (v) => Math.round(parseFloat(v));
    const s = el.style;
    return { x: n(s.left), y: n(s.top), w: n(s.width), h: n(s.height) };
  });
/** A drawn box (the bubble, the header) from the layout. */
const rect = async (l) => {
  const b = await l.boundingBox();
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
};
const handles = (p) => p.getByTitle("Drag to resize");
/** Press at (x, y), move to (x + dx, y + dy), release — with pointer events, as the window listens for. */
const dragBy = async (p, x, y, dx, dy) => {
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(x + dx / 2, y + dy / 2);
  await p.mouse.move(x + dx, y + dy);
  await p.mouse.up();
};
const size = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("vaulte_chat_size")));
const input = (p) => p.locator("textarea").last();

test("opens beside the bubble at the default size, fixed on <body>; closes back to it", async ({
  page: p,
}) => {
  await start(p);
  await expect(win(p)).toBeHidden();
  await expect(bubble(p).locator("svg")).toHaveCount(1); // the chat icon
  await bubble(p).click();
  await expect(win(p)).toBeVisible();
  const b = await rect(bubble(p));
  const w = await box(win(p));
  expect([w.w, w.h]).toEqual([540, 680]);
  expect(w.x + w.w).toBe(b.x + b.w); // right edges aligned
  expect(w.y + w.h).toBe(b.y - 14); // just above the bubble
  expect(
    await win(p).evaluate((el) => [el.parentElement.tagName, getComputedStyle(el).position]),
  ).toEqual(["BODY", "fixed"]);
  await expect(bubble(p).locator("svg path[d='M4 4l8 8M12 4l-8 8']")).toBeVisible(); // × icon
  await bubble(p).click();
  await expect(win(p)).toBeHidden();
  await bubble(p).click();
  await expect(win(p)).toBeVisible();
  expect(await box(win(p))).toEqual(w); // back beside the bubble
  await header(p).locator("button", { hasText: "×" }).click();
  await expect(win(p)).toBeHidden();
  expect(await size(p)).toBeNull(); // nothing remembered until a resize
});

test("drag by the header moves it, clamped 8 px from the display's edges; buttons still click", async ({
  page: p,
}) => {
  await start(p);
  await bubble(p).click();
  const w0 = await box(win(p));
  const h = await rect(header(p));
  await dragBy(p, h.x + 100, h.y + h.h / 2, -200, 100);
  const w1 = await box(win(p));
  expect([w1.x, w1.y]).toEqual([w0.x - 200, w0.y + 100]);
  expect([w1.w, w1.h]).toEqual([w0.w, w0.h]);
  await dragBy(p, w1.x + 100, w1.y + 20, -2000, -2000); // far past the top-left
  expect(await box(win(p))).toMatchObject({ x: 8, y: 8 });
  await dragBy(p, 108, 28, 5000, 5000); // far past the bottom-right
  const v = p.viewportSize();
  expect(await box(win(p))).toMatchObject({ x: v.width - w0.w - 8, y: v.height - w0.h - 8 });
  expect(await p.evaluate(() => document.body.style.userSelect)).toBe(""); // selection re-enabled
  // a right-button press or a press on a header button doesn't drag
  const w2 = await box(win(p));
  await p.mouse.move(w2.x + 100, w2.y + 20);
  await p.mouse.down({ button: "right" });
  await p.mouse.move(w2.x + 50, w2.y + 60);
  await p.mouse.up({ button: "right" });
  expect(await box(win(p))).toEqual(w2);
  const x = await rect(header(p).locator("button", { hasText: "×" }));
  await dragBy(p, x.x + x.w / 2, x.y + x.h / 2, -60, 40);
  expect(await box(win(p))).toEqual(w2);
  await expect(win(p)).toBeVisible(); // a drag that ends elsewhere isn't a click
  await header(p).locator("button", { hasText: "×" }).click();
  await expect(win(p)).toBeHidden();
});

test("at the context limit the count says 'Last 30 messages'", async ({ page: p }) => {
  const history = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: "m" + i,
  }));
  await start(p, { __docs: { [P("claude_chat/conversation")]: { history } } });
  await bubble(p).click();
  await expect(p.getByText("Last 30 messages", { exact: true })).toBeVisible();
});

test("resize from each edge and corner; the opposite side stays put; size remembered", async ({
  page: p,
}) => {
  await start(p);
  await bubble(p).click();
  const h = await rect(header(p));
  const at = await box(win(p));
  await dragBy(p, h.x + 100, h.y + 10, 200 - at.x, 100 - at.y); // room to grow on every side
  const w0 = await box(win(p));
  expect([w0.x, w0.y]).toEqual([200, 100]);
  await expect(handles(p)).toHaveCount(8);
  // right edge: wider, left edge fixed
  await dragBy(p, w0.x + w0.w - 2, w0.y + w0.h / 2, 60, 0);
  let w = await box(win(p));
  expect(w).toEqual({ ...w0, w: w0.w + 60 });
  // bottom edge: taller
  await dragBy(p, w.x + w.w / 2, w.y + w.h - 2, 0, 40);
  w = await box(win(p));
  expect(w).toEqual({ ...w0, w: w0.w + 60, h: w0.h + 40 });
  // left edge: wider leftwards, right edge fixed
  await dragBy(p, w.x + 2, w.y + w.h / 2, -30, 0);
  const right = w.x + w.w;
  w = await box(win(p));
  expect([w.x, w.x + w.w]).toEqual([w0.x - 30, right]);
  // top edge: taller upwards, bottom fixed
  const bottom = w.y + w.h;
  await dragBy(p, w.x + w.w / 2, w.y + 2, 0, -20);
  w = await box(win(p));
  expect([w.y, w.y + w.h]).toEqual([w0.y - 20, bottom]);
  // top-left corner: both
  const r2 = w.x + w.w,
    b2 = w.y + w.h;
  await dragBy(p, w.x + 3, w.y + 3, -10, -10);
  w = await box(win(p));
  expect([w.x + w.w, w.y + w.h, w.w, w.h]).toEqual([r2, b2, r2 - (w0.x - 40), b2 - (w0.y - 30)]);
  // bottom-right corner
  await dragBy(p, w.x + w.w - 3, w.y + w.h - 3, 15, 25);
  const w3 = await box(win(p));
  expect([w3.x, w3.y, w3.w, w3.h]).toEqual([w.x, w.y, w.w + 15, w.h + 25]);
  expect(await size(p)).toEqual({ w: w3.w, h: w3.h });
  // remembered across a reload, placed beside the bubble again
  await p.reload();
  await p.getByText("October 2026").waitFor();
  await bubble(p).click();
  const w4 = await box(win(p));
  expect([w4.w, w4.h]).toEqual([w3.w, w3.h]);
  const b = await rect(bubble(p));
  const v = p.viewportSize();
  expect(w4.x + w4.w).toBe(b.x + b.w);
  // above the bubble when it fits, else as low as fits, never above the top margin
  expect(w4.y).toBe(Math.max(8, Math.min(b.y - 14 - w4.h, v.height - w4.h - 8)));
});

test("resizing stops at the minimum (340 × 420) and at the display edge; the stored size is clamped", async ({
  page: p,
}) => {
  await start(p);
  await bubble(p).click();
  let w = await box(win(p));
  await dragBy(p, w.x + w.w - 2, w.y + w.h / 2, -500, 0); // right edge far left
  w = await box(win(p));
  expect(w.w).toBe(340);
  await dragBy(p, w.x + w.w / 2, w.y + w.h - 2, 0, -900); // bottom edge far up
  w = await box(win(p));
  expect(w.h).toBe(420);
  await dragBy(p, w.x + 2, w.y + w.h / 2, -2000, 0); // left edge past the display
  w = await box(win(p));
  expect(w.x).toBe(8);
  await dragBy(p, w.x + w.w / 2, w.y + 2, 0, -2000); // top edge past the display
  w = await box(win(p));
  expect(w.y).toBe(8);
  expect(await size(p)).toEqual({ w: w.w, h: w.h });
  // a stored size larger than the display is clamped; a broken one is ignored
  await p.evaluate(() =>
    localStorage.setItem("vaulte_chat_size", JSON.stringify({ w: 5000, h: 5000 })),
  );
  await p.reload();
  await p.getByText("October 2026").waitFor();
  await bubble(p).click();
  const v = p.viewportSize();
  w = await box(win(p));
  expect([w.w, w.h, w.x, w.y]).toEqual([v.width - 16, v.height - 16, 8, 8]);
  await p.evaluate(() => localStorage.setItem("vaulte_chat_size", "{not json"));
  await p.reload();
  await p.getByText("October 2026").waitFor();
  await bubble(p).click();
  w = await box(win(p));
  expect([w.w, w.h]).toEqual([540, 680]);
});

test("a browser resize keeps the window on screen", async ({ page: p }) => {
  await start(p);
  await bubble(p).click();
  const w0 = await box(win(p));
  expect([w0.w, w0.h]).toEqual([540, 680]);
  await p.setViewportSize({ width: 700, height: 500 });
  // too tall: shrunk to the display less the margins; still narrow enough: moved to fit
  await expect.poll(async () => box(win(p))).toEqual({ x: 152, y: 8, w: 540, h: 484 });
  await p.setViewportSize({ width: 1400, height: 900 });
  await p.waitForTimeout(300);
  expect(await box(win(p))).toEqual({ x: 152, y: 8, w: 540, h: 484 }); // stays as it was
});

test("header: Clear only with messages; message count; Enter sends, Shift+Enter is a newline", async ({
  page: p,
}) => {
  const history = Array.from({ length: 4 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: "m" + i,
  }));
  await start(p, { __docs: { [P("claude_chat/conversation")]: { history } } });
  await bubble(p).click();
  await expect(p.getByText("4 messages", { exact: true })).toBeVisible();
  await expect(header(p).getByRole("button", { name: /Clear/ })).toBeVisible();
  await expect(p.getByText("Ask nutrition questions, or switch to a meal slot")).toBeHidden();
  await input(p).fill("line one");
  await input(p).press("Shift+Enter");
  await input(p).type("line two");
  await expect(input(p)).toHaveValue("line one\nline two");
  expect(await p.evaluate(() => window.__chatCalls?.length || 0)).toBe(0);
  await header(p).getByRole("button", { name: /Clear/ }).click();
  await expect(p.getByText("4 messages", { exact: true })).toBeHidden();
  await expect(header(p).getByRole("button", { name: /Clear/ })).toBeHidden();
  await expect(p.getByText("Ask nutrition questions, or switch to a meal slot")).toBeVisible();
  await expect(input(p)).toHaveAttribute("placeholder", "Ask me anything…");
  await p.evaluate(() => {
    window.__chatReply = "r";
    window.__chatDelay = 1200;
  });
  await input(p).press("Enter");
  const send = input(p).locator("..").locator("button");
  await expect(send).toBeDisabled(); // while Claude answers
  await expect.poll(() => p.evaluate(() => window.__chatCalls?.length || 0)).toBe(1);
  await expect(p.getByText("2 messages", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(send).toBeEnabled();
});

test("the context bar: the date is editable; the meal list follows the chosen day", async ({
  page: p,
}) => {
  await start(p, { __docs: { [P("claude_chat/conversation")]: { history: [] } } });
  await bubble(p).click();
  const date = p.locator("input[type=date]");
  await expect(date).toHaveValue("2026-10-01"); // the open day
  const meals = p.locator("select").filter({ has: p.locator('option[value="__chat__"]') });
  const SLOTS = ["☕ Breakfast", "🥤 Post-Workout", "🥗 Lunch", "🍎 Snack", "🌙 Dinner"];
  await expect(meals.locator("option")).toHaveText(["Chat mode", ...SLOTS, "Breakfast"]); // the open day
  await meals.selectOption({ label: "🥗 Lunch" });
  await expect(input(p)).toHaveAttribute("placeholder", "Describe what you ate…");
  await date.fill("2026-10-04"); // a stored day: its meal, then the slots
  await expect(date).toHaveValue("2026-10-04");
  await expect(meals.locator("option")).toHaveText(["Chat mode", ...SLOTS, "Breakfast"]);
  await date.fill("2026-09-15"); // no stored day: the default slots (Fix 30)
  await expect(meals.locator("option")).toHaveText(["Chat mode", ...SLOTS]);
});
