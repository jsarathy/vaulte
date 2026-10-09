// tests/trackerStart.test.mjs — shaping NutritionTracker's start-up data (Fix 26 PR 18)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALCULATOR_DEFAULTS,
  calculatorFromDoc,
  calculatorDoc,
  datedRows,
  unloggedSessions,
  chatMessagesFrom,
  compareStart,
  RECENT_DAYS,
  mergeDays,
  mergeRows,
  keepIfTouched,
  POLAR_RETURN,
} from "../src/lib/trackerStart.js";

const snap = (id, data) => ({ id, data: () => data });

test("calculator: defaults; usable saved values only", () => {
  assert.deepEqual(CALCULATOR_DEFAULTS, {
    sex: "m",
    age: 60,
    height: 165,
    weight: 84,
    protein: 1.4,
    fatPct: 30,
  });
  assert.deepEqual(
    calculatorFromDoc({ sex: "f", age: 40, height: "tall", weight: 70, protein: 1.6, fatPct: 0 }),
    { sex: "f", age: 40, weight: 70, protein: 1.6, fatPct: 0 },
  );
  assert.deepEqual(calculatorFromDoc({ sex: "", age: NaN, height: Infinity, weight: null }), {});
  assert.deepEqual(calculatorFromDoc({ height: 170 }), { height: 170 });
});

test("calculator document", () => {
  const now = new Date("2026-10-04T09:00:00Z");
  assert.deepEqual(calculatorDoc({ ...CALCULATOR_DEFAULTS, extra: 1 }, now), {
    ...CALCULATOR_DEFAULTS,
    updated_at: "2026-10-04T09:00:00.000Z",
  });
});

test("dated rows: id as date (fields may override), in date order", () => {
  assert.deepEqual(
    datedRows([
      snap("2026-10-03", { w: 3 }),
      snap("2026-10-01", { w: 1 }),
      snap("x", { date: null }),
    ]),
    [{ date: null }, { date: "2026-10-01", w: 1 }, { date: "2026-10-03", w: 3 }],
  );
});

test("Polar sessions: unlogged, newest first, undated last", () => {
  const out = unloggedSessions([
    snap("a", { start_time: "2026-10-01T08:00" }),
    snap("d", {}),
    snap("b", { start_time: "2026-10-03T08:00" }),
    snap("c", { start_time: "2026-10-04T08:00", logged: true }),
  ]);
  assert.deepEqual(
    out.map((s) => s.id),
    ["b", "a", "d"],
  );
  assert.deepEqual(out[0], { id: "b", start_time: "2026-10-03T08:00" });
});

test("chat messages from history", () => {
  let n = 0;
  const msgs = chatMessagesFrom(
    [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "other", content: "?" },
    ],
    () => "m" + n++,
  );
  assert.deepEqual(msgs, [
    { id: "m0", type: "user", text: "hi" },
    { id: "m1", type: "claude", text: "hello" },
    { id: "m2", type: "claude", text: "?" },
  ]);
});

test("Compare start: first 5 days with entries, then empty slots", () => {
  const day = (date, n) => ({ date, meals: [{ items: Array(n).fill({}) }] });
  const days = [day("a", 1), day("b", 0), { date: "c" }, day("d", 2)];
  assert.deepEqual(compareStart(days), {
    slots: ["a", "d", null, null, null],
    data: [days[0], days[3], null, null, null],
  });
  const many = ["1", "2", "3", "4", "5", "6"].map((d) => day(d, 1));
  assert.deepEqual(compareStart(many).slots, ["1", "2", "3", "4", "5"]);
  assert.deepEqual(compareStart(many).data, many.slice(0, 5));
  assert.deepEqual(compareStart([]).slots, [null, null, null, null, null]);
});

test("Polar return messages", () => {
  assert.deepEqual(POLAR_RETURN.get("connected"), {
    ok: true,
    text: "Polar connected — click Sync to pull sessions.",
  });
  assert.deepEqual(POLAR_RETURN.get("error"), { ok: false, text: "Polar connection failed." });
  assert.equal(POLAR_RETURN.has("constructor"), false);
  assert.equal(POLAR_RETURN.size, 2);
});

test("the first screen reads the last 5 days", () => {
  assert.equal(RECENT_DAYS, 5);
});

test("mergeDays: every day once, newest first; a day already on screen wins", () => {
  const shown = [{ date: "2026-10-07", notes: "edited" }, { date: "2026-10-06" }];
  const stored = [
    { date: "2026-10-07", notes: "old" },
    { date: "2026-10-06" },
    { date: "2026-10-01" },
  ];
  assert.deepEqual(mergeDays(shown, stored), [
    { date: "2026-10-07", notes: "edited" },
    { date: "2026-10-06" },
    { date: "2026-10-01" },
  ]);
  assert.deepEqual(mergeDays([], stored), stored);
  assert.deepEqual(mergeDays(shown, []), shown);
});

test("mergeDays: when the stored days add none, the ones on screen are kept as they are", () => {
  const shown = [{ date: "2026-10-01" }, { date: "2026-10-04" }]; // any order
  assert.equal(mergeDays(shown, [{ date: "2026-10-04" }, { date: "2026-10-01" }]), shown);
});

test("mergeRows: every date once, oldest first; a row already on screen wins", () => {
  const shown = [{ date: "2026-10-03", kg: 80 }];
  const stored = [
    { date: "2026-10-01", kg: 82 },
    { date: "2026-10-03", kg: 99 },
  ];
  assert.deepEqual(mergeRows(shown, stored), [
    { date: "2026-10-01", kg: 82 },
    { date: "2026-10-03", kg: 80 },
  ]);
});

test("keepIfTouched: Compare is replaced only while it still holds its first days", () => {
  const first = ["2026-10-05", null, null];
  const next = ["2026-10-05", "2026-10-02", "2026-09-30"];
  assert.deepEqual(keepIfTouched(first, first, next), next);
  assert.deepEqual(keepIfTouched([{ date: "2026-10-05" }, null, null], first, next), next);
  const changed = ["2026-10-05", "2026-10-01", null];
  assert.deepEqual(keepIfTouched(changed, first, next), changed);
});
