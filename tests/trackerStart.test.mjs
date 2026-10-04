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
