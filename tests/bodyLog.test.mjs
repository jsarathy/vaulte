// tests/bodyLog.test.mjs — the Body tab's log (src/lib/bodyLog.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toReading,
  withReading,
  newestFirst,
  rowBackground,
  mergeTapeRecords,
  syncedText,
  syncError,
} from "../src/lib/bodyLog.js";

test("typed readings", () => {
  assert.equal(toReading("101.5"), 101.5);
  assert.equal(toReading(" 99 "), 99);
  assert.equal(toReading("0"), 0);
  assert.equal(toReading(""), null);
  assert.equal(toReading("   "), null);
  assert.equal(toReading("-"), null);
  assert.equal(toReading("Infinity"), null);
  assert.equal(toReading(42), 42);
});

test("changing a reading; row order and shading", () => {
  const log = [
    { date: "a", waist: 1 },
    { date: "b", hip: 2 },
  ];
  const { row, rows } = withReading(log, 1, { hip: null });
  assert.deepEqual(row, { date: "b", hip: null });
  assert.deepEqual(rows, [log[0], row]);
  assert.deepEqual(log[1], { date: "b", hip: 2 }); // not changed in place
  assert.deepEqual(
    newestFirst(log).map(({ row: r, i }) => [r.date, i]),
    [
      ["b", 1],
      ["a", 0],
    ],
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => rowBackground(i, 4)),
    ["#fff", "#F7FAFD", "#fff", "#E3F2FD"],
  );
  assert.equal(rowBackground(2, 4), "#fff");
});

test("merging tape records", () => {
  const log = [
    { date: "2026-09-20", waist: 101 },
    { date: "2026-09-27", waist: 100, chest: 109 },
  ];
  const { merged, rows } = mergeTapeRecords(log, [
    { date: "2026-09-27", values: { waist: 99.5, hip: 107 } },
    { date: "2026-09-24", values: { neck: 41, date: "x" } },
  ]);
  assert.deepEqual(merged, [
    { date: "2026-09-27", waist: 99.5, chest: 109, hip: 107 },
    { date: "x", neck: 41 }, // (sic) a "date" among the values wins
  ]);
  assert.deepEqual(
    rows.map((r) => r.date),
    ["2026-09-20", "2026-09-27", "x"],
  );
  assert.deepEqual(rows[1], merged[0]);
  // rows without a date sort first
  const odd = mergeTapeRecords([{ waist: 1 }], [{ date: "2026-01-01", values: {} }]).rows;
  assert.deepEqual(odd, [{ waist: 1 }, { date: "2026-01-01" }]);
  const odd2 = mergeTapeRecords(
    [{ date: "2026-02-01" }, { waist: 1 }],
    [{ date: "2026-01-01", values: {} }],
  );
  assert.deepEqual(odd2.rows, [{ waist: 1 }, { date: "2026-01-01" }, { date: "2026-02-01" }]);
  assert.equal(syncedText(1), "Synced 1 day.");
  assert.equal(syncedText(2), "Synced 2 days.");
  assert.equal(syncError(502, { error: "Login failed" }), "Login failed");
  assert.equal(syncError(500, {}), "Sync failed (HTTP 500)");
});
