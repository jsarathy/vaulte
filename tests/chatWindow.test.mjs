// tests/chatWindow.test.mjs — the chat window's geometry (src/lib/chatWindow.js) and the texts
// and tables around the messages (src/lib/chatMessages.js), Fix 26 PR 38.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SIZE,
  HANDLES,
  MARGIN,
  MIN,
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

test("mealsForDate: the stored day's meals, else the open day's; exercise slots left out", () => {
  const days = [
    {
      date: "2026-10-01",
      meals: [
        { id: "a", name: "A" },
        { id: "x", name: "Run", is_exercise: 1 },
      ],
    },
    { date: "2026-10-02" },
  ];
  const current = { meals: [{ id: "c", name: "C" }] };
  assert.deepEqual(mealsForDate(days, "2026-10-01", current), [{ id: "a", name: "A" }]);
  assert.deepEqual(mealsForDate(days, "2026-10-02", current), []); // stored, no meals
  assert.deepEqual(mealsForDate(days, "2026-09-30", current), [{ id: "c", name: "C" }]);
  assert.deepEqual(mealsForDate(days, "2026-09-30", null), []);
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
