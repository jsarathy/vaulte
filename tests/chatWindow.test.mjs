// tests/chatWindow.test.mjs — the chat window's geometry (src/lib/chatWindow.js) and the texts
// and tables around the messages (src/lib/chatMessages.js), Fix 26 PR 38.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SIZE,
  HANDLES,
  MARGIN,
  MIN,
  STORAGE_KEY,
  clampPos,
  clampSize,
  openingPos,
  resizedBox,
  storedSize,
} from "../src/lib/chatWindow.js";
import {
  CHAT_MODE,
  PREVIEW_COLUMNS,
  asHtml,
  cellText,
  historyLabel,
  itemValues,
  loggedLabel,
  mealsForDate,
  placeholderFor,
  previewTotals,
} from "../src/lib/chatMessages.js";

const VIEW = { w: 1400, h: 900 };

test("clampSize: at least the minimum, at most the display less the margins, rounded", () => {
  assert.deepEqual(clampSize({ w: 540, h: 680 }, VIEW), { w: 540, h: 680 });
  assert.deepEqual(clampSize({ w: 10, h: 10 }, VIEW), MIN);
  assert.deepEqual(clampSize({ w: 5000, h: 5000 }, VIEW), { w: 1384, h: 884 });
  assert.deepEqual(clampSize({ w: 540.4, h: 680.6 }, VIEW), { w: 540, h: 681 });
  // a display smaller than the minimum: the minimum wins
  assert.deepEqual(clampSize({ w: 600, h: 600 }, { w: 300, h: 300 }), MIN);
  assert.equal(MARGIN, 8);
});

test("clampPos: within the margins for the window's size", () => {
  const size = { w: 540, h: 680 };
  assert.deepEqual(clampPos({ x: 100, y: 50 }, size, VIEW), { x: 100, y: 50 });
  assert.deepEqual(clampPos({ x: -50, y: -50 }, size, VIEW), { x: 8, y: 8 });
  assert.deepEqual(clampPos({ x: 5000, y: 5000 }, size, VIEW), { x: 852, y: 212 });
  assert.deepEqual(clampPos({ x: 100.4, y: 50.5 }, size, VIEW), { x: 100, y: 51 });
  // a window wider than the display sits at the margin
  assert.deepEqual(clampPos({ x: 500, y: 500 }, { w: 2000, h: 2000 }, VIEW), { x: 8, y: 8 });
});

test("storedSize: a remembered size is clamped; missing, broken or partial → the default", () => {
  assert.deepEqual(storedSize('{"w":600,"h":500}', VIEW), { w: 600, h: 500 });
  assert.deepEqual(storedSize('{"w":5000,"h":5000}', VIEW), { w: 1384, h: 884 });
  assert.deepEqual(storedSize('{"w":10,"h":10}', VIEW), MIN);
  assert.deepEqual(storedSize(null, VIEW), DEFAULT_SIZE);
  assert.deepEqual(storedSize("", VIEW), DEFAULT_SIZE);
  assert.deepEqual(storedSize("{not json", VIEW), DEFAULT_SIZE);
  assert.deepEqual(storedSize('{"w":600}', VIEW), DEFAULT_SIZE);
  assert.deepEqual(storedSize('{"w":0,"h":500}', VIEW), DEFAULT_SIZE);
  assert.deepEqual(storedSize("null", VIEW), DEFAULT_SIZE);
  assert.deepEqual(DEFAULT_SIZE, { w: 540, h: 680 });
});

test("openingPos: above the bubble with right edges aligned, clamped; bottom-right without one", () => {
  const size = { w: 540, h: 680 };
  const bubble = { right: 1350, top: 850 };
  assert.deepEqual(openingPos(bubble, size, VIEW), { x: 810, y: 156 });
  assert.deepEqual(openingPos({ right: 300, top: 200 }, size, VIEW), { x: 8, y: 8 }); // too far up / left
  assert.deepEqual(openingPos(null, size, VIEW), { x: 836, y: 130 });
  assert.deepEqual(openingPos(undefined, size, { w: 600, h: 700 }), { x: 36, y: 8 });
});

test("resizedBox: the dragged side moves, the opposite side stays, limits apply", () => {
  const from = { size: { w: 540, h: 680 }, pos: { x: 200, y: 100 } };
  const drag = (dx, dy, x, y) => resizedBox({ dx, dy }, from, { delta: { x, y }, view: VIEW });
  assert.deepEqual(drag(1, 0, 60, 99), { size: { w: 600, h: 680 }, pos: { x: 200, y: 100 } });
  assert.deepEqual(drag(0, 1, 99, 40), { size: { w: 540, h: 720 }, pos: { x: 200, y: 100 } });
  assert.deepEqual(drag(-1, 0, -30, 0), { size: { w: 570, h: 680 }, pos: { x: 170, y: 100 } });
  assert.deepEqual(drag(0, -1, 0, -20), { size: { w: 540, h: 700 }, pos: { x: 200, y: 80 } });
  assert.deepEqual(drag(-1, -1, -10, -10), { size: { w: 550, h: 690 }, pos: { x: 190, y: 90 } });
  assert.deepEqual(drag(1, 1, 15, 25), { size: { w: 555, h: 705 }, pos: { x: 200, y: 100 } });
  // shrinking stops at the minimum; the fixed side still stays put
  assert.deepEqual(drag(1, 0, -500, 0), { size: { w: 340, h: 680 }, pos: { x: 200, y: 100 } });
  assert.deepEqual(drag(-1, 0, 500, 0), { size: { w: 340, h: 680 }, pos: { x: 400, y: 100 } });
  assert.deepEqual(drag(0, -1, 0, 900), { size: { w: 540, h: 420 }, pos: { x: 200, y: 360 } });
  // growing stops at the display's margin on the dragged side
  assert.deepEqual(drag(-1, 0, -2000, 0), { size: { w: 732, h: 680 }, pos: { x: 8, y: 100 } });
  assert.deepEqual(drag(0, -1, 0, -2000), { size: { w: 540, h: 772 }, pos: { x: 200, y: 8 } });
  assert.deepEqual(drag(1, 0, 2000, 0), { size: { w: 1192, h: 680 }, pos: { x: 200, y: 100 } });
  assert.deepEqual(drag(0, 1, 0, 2000), { size: { w: 540, h: 792 }, pos: { x: 200, y: 100 } });
});

test("HANDLES: four edges and four corners with their cursors", () => {
  assert.equal(HANDLES.length, 8);
  assert.deepEqual(
    HANDLES.map(([dx, dy]) => `${dx},${dy}`),
    ["0,-1", "0,1", "-1,0", "1,0", "-1,-1", "1,1", "1,-1", "-1,1"],
  );
  assert.deepEqual(HANDLES[0][2], { top: 0, left: 14, right: 14, height: 6 });
  assert.deepEqual(HANDLES[2][2], { left: 0, top: 14, bottom: 14, width: 6 });
  assert.deepEqual(HANDLES[5][2], { bottom: 0, right: 0, width: 14, height: 14 });
  assert.deepEqual(
    HANDLES.map((h) => h[3]),
    [
      "ns-resize",
      "ns-resize",
      "ew-resize",
      "ew-resize",
      "nwse-resize",
      "nwse-resize",
      "nesw-resize",
      "nesw-resize",
    ],
  );
});

test("mealsForDate: the chat day's own meals, default slots it lacks by name (Fix 30)", () => {
  const slot = (name) => ({ id: "__slot__" + name, name });
  const SLOTS = ["☕ Breakfast", "🥤 Post-Workout", "🥗 Lunch", "🍎 Snack", "🌙 Dinner"].map(slot);
  const days = [
    {
      date: "2026-10-01",
      meals: [
        { id: "a", name: "A" },
        { id: "b", name: "☕ Breakfast" },
        { id: "x", name: "Run", is_exercise: 1 },
      ],
    },
    { date: "2026-10-02" },
  ];
  const names = (list) => list.map((m) => [m.id, m.name]);
  // stored: its meals keep their ids, missing slots by name, custom meals last, no exercise
  assert.deepEqual(names(mealsForDate(days, "2026-10-01", null)), [
    ["b", "☕ Breakfast"],
    ...names(SLOTS.slice(1)),
    ["a", "A"],
  ]);
  assert.deepEqual(mealsForDate(days, "2026-10-02", null), SLOTS); // stored, no meals
  // not stored: the open day when it is that day, else the default slots
  const open = { date: "2026-09-30", meals: [{ id: "c", name: "C" }] };
  assert.deepEqual(names(mealsForDate(days, "2026-09-30", open)), [...names(SLOTS), ["c", "C"]]);
  assert.deepEqual(mealsForDate(days, "2026-09-29", open), SLOTS);
  assert.deepEqual(mealsForDate(days, "2026-09-29", null), SLOTS);
});

test("labels: history count, placeholder, logged items, html line breaks", () => {
  assert.equal(historyLabel(3, 30), "3 messages");
  assert.equal(historyLabel(30, 30), "Last 30 messages");
  assert.equal(historyLabel(31, 30), "Last 30 messages");
  assert.equal(placeholderFor(CHAT_MODE), "Ask me anything…");
  assert.equal(placeholderFor("m1"), "Describe what you ate…");
  assert.equal(CHAT_MODE, "__chat__");
  assert.equal(loggedLabel([1]), "Logged 1 item");
  assert.equal(loggedLabel([1, 2]), "Logged 2 items");
  assert.equal(loggedLabel([]), "Logged 0 items");
  assert.equal(asHtml("a\nb\n"), "a<br/>b<br/>");
});

test("preview table: columns, a row's values, totals, cell text", () => {
  assert.deepEqual(PREVIEW_COLUMNS, ["Item", "kcal", "Fat", "Carbs", "Fibre", "Prot"]);
  const egg = { name: "Egg", kcal: 70, fat: 5, carbs: 0.4, fibre: 0, protein: 6, sugar: 9 };
  assert.deepEqual(itemValues(egg), [70, 5, 0.4, 0, 6]);
  assert.deepEqual(previewTotals([egg, egg]), [140, 10, 0.8, 0, 12]);
  assert.deepEqual(previewTotals([]), [0, 0, 0, 0, 0]);
  assert.equal(cellText(70, 0), "70");
  assert.equal(cellText(5, 1), "5g");
  assert.equal(cellText(0.4, 2), "0.4g");
});

// Fix 78 ---------------------------------------------------------------------------------

test("the remembered size is stored under vaulte_chat_size", () => {
  assert.equal(STORAGE_KEY, "vaulte_chat_size");
});

test("resizedBox: a drag on one axis leaves the other axis alone, even for a window already past a limit", () => {
  const view = VIEW; // 1400 x 900
  const go = (dir, from, x, y) => resizedBox(dir, from, { delta: { x, y }, view });
  // partly off the right edge (pos.x 1000 + 540 > 1400 - 8): a vertical drag keeps the width
  let from = { size: { w: 540, h: 500 }, pos: { x: 1000, y: 100 } };
  assert.deepEqual(go({ dx: 0, dy: 1 }, from, 50, 40), {
    size: { w: 540, h: 540 },
    pos: { x: 1000, y: 100 },
  });
  // starting left of the left margin (pos.x 0): a vertical drag keeps the width and the left side
  from = { size: { w: 540, h: 500 }, pos: { x: 0, y: 100 } };
  assert.deepEqual(go({ dx: 0, dy: -1 }, from, 30, -40), {
    size: { w: 540, h: 540 },
    pos: { x: 0, y: 60 },
  });
  // partly off the bottom edge (pos.y 600 + 500 > 900 - 8): a horizontal drag keeps the height
  from = { size: { w: 540, h: 500 }, pos: { x: 100, y: 600 } };
  assert.deepEqual(go({ dx: 1, dy: 0 }, from, 40, 50), {
    size: { w: 580, h: 500 },
    pos: { x: 100, y: 600 },
  });
  // starting above the top margin (pos.y 0): a horizontal drag keeps the height and the top
  from = { size: { w: 540, h: 500 }, pos: { x: 100, y: 0 } };
  assert.deepEqual(go({ dx: -1, dy: 0 }, from, -40, 30), {
    size: { w: 580, h: 500 },
    pos: { x: 60, y: 0 },
  });
});

test("resizedBox: a window smaller than the minimum is raised to it on the other axis without moving", () => {
  const view = VIEW;
  const small = { size: { w: 300, h: 380 }, pos: { x: 200, y: 100 } };
  // dragging only the height: the width is lifted to 340 and the left side stays at 200
  assert.deepEqual(resizedBox({ dx: 0, dy: 1 }, small, { delta: { x: 0, y: 100 }, view }), {
    size: { w: 340, h: 480 },
    pos: { x: 200, y: 100 },
  });
  // dragging only the width: the height is lifted to 420 and the top stays at 100
  assert.deepEqual(resizedBox({ dx: 1, dy: 0 }, small, { delta: { x: 100, y: 0 }, view }), {
    size: { w: 400, h: 420 },
    pos: { x: 200, y: 100 },
  });
});

test("HANDLES: the box of every handle", () => {
  assert.deepEqual(
    HANDLES.map((h) => h[2]),
    [
      { top: 0, left: 14, right: 14, height: 6 },
      { bottom: 0, left: 14, right: 14, height: 6 },
      { left: 0, top: 14, bottom: 14, width: 6 },
      { right: 0, top: 14, bottom: 14, width: 6 },
      { top: 0, left: 0, width: 14, height: 14 },
      { bottom: 0, right: 0, width: 14, height: 14 },
      { top: 0, right: 0, width: 14, height: 14 },
      { bottom: 0, left: 0, width: 14, height: 14 },
    ],
  );
});
