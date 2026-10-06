// tests/weightLogTable.test.mjs — the Weight tab's log table figures (Fix 26 PR 22). The table
// on screen is pinned by tests/ui/weight-log-table.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cumLossBaseline,
  syncFromOf,
  staleCount,
  purgePrompt,
  vsProjFigure,
  twoWeekFigure,
  cumLossFigure,
  tableRows,
  editedRow,
} from "../src/lib/weightLogTable.js";

test("baseline, sync cutoff and purge wording", () => {
  assert.equal(cumLossBaseline({ cumLossBaselineKg: 90 }), 90);
  assert.equal(cumLossBaseline({ cumLossBaselineKg: "85.5" }), 85.5);
  assert.equal(cumLossBaseline({ cumLossBaselineKg: "lots" }), 86.45);
  assert.equal(cumLossBaseline({}), 86.45);
  // blank, cleared or not above 0: the default (Fix 31)
  for (const kg of [null, "", " ", 0, "0", -5])
    assert.equal(cumLossBaseline({ cumLossBaselineKg: kg }), 86.45, String(kg));
  assert.equal(syncFromOf({ syncFromDate: "2026-09-01", startDate: "2026-08-16" }), "2026-09-01");
  assert.equal(syncFromOf({ syncFromDate: "", startDate: "2026-08-16" }), "2026-08-16");
  assert.equal(syncFromOf({}), null);
  const log = [
    { date: "2026-08-01" },
    { date: "2026-08-16" },
    {},
    { date: "" },
    { date: "2026-08-15" },
  ];
  assert.equal(staleCount(log, "2026-08-16"), 2);
  assert.equal(staleCount(log, null), 0);
  assert.equal(purgePrompt(1, "X"), "Delete 1 record dated before X? This cannot be undone.");
  assert.equal(purgePrompt(2, "X"), "Delete 2 records dated before X? This cannot be undone.");
  assert.equal(purgePrompt(0, "X"), "Delete 0 records dated before X? This cannot be undone.");
});

test("figures as shown", () => {
  assert.deepEqual(vsProjFigure("1.2"), { text: "+1.2", tone: "up" });
  assert.deepEqual(vsProjFigure("-0.4"), { text: "-0.4", tone: "down" });
  assert.deepEqual(vsProjFigure("0.0"), { text: "0.0", tone: "flat" });
  assert.deepEqual(vsProjFigure("-0.0"), { text: "-0.0", tone: "flat" });
  assert.deepEqual(vsProjFigure(null), { text: "—", tone: null });
  assert.deepEqual(twoWeekFigure("0.8"), { text: "-0.8 kg", tone: "up" });
  assert.deepEqual(twoWeekFigure("-0.5"), { text: "+0.5 kg", tone: "down" });
  assert.deepEqual(twoWeekFigure("-1.0"), { text: "+1.0 kg", tone: "down" });
  // no change either way shows unsigned (Fix 31)
  assert.deepEqual(twoWeekFigure("0.0"), { text: "0.0 kg", tone: "flat" });
  assert.deepEqual(twoWeekFigure("-0.0"), { text: "0.0 kg", tone: "flat" });
  assert.deepEqual(twoWeekFigure(null), { text: "—", tone: null });
  assert.equal(cumLossFigure({ actual: 84.25 }, 86.45), "-2.2 kg");
  assert.equal(cumLossFigure({ actual: 0 }, 86.45), "-86.5 kg");
  // at or above the baseline: a gain as "+x kg", none as "0.0 kg" (Fix 31)
  assert.equal(cumLossFigure({ actual: 87.45 }, 86.45), "+1.0 kg");
  assert.equal(cumLossFigure({ actual: 86.45 }, 86.45), "0.0 kg");
  assert.equal(cumLossFigure({ actual: 86.44 }, 86.45), "0.0 kg");
  assert.equal(cumLossFigure({ actual: 86.5 }, 86.45), "0.0 kg");
  assert.equal(cumLossFigure({ actual: null }, 86.45), null);
  assert.equal(cumLossFigure({}, 86.45), null);
});

const cfg = {
  startDate: "2026-08-16",
  startWeightKg: 84,
  planAnchors: [{ week: 2, weightKg: 82 }],
  cumLossBaselineKg: 86,
};

test("rows: latest first, with figures, past and current", () => {
  const log = [
    { date: "2026-08-10", actual: 85 }, // before the plan
    { date: "2026-08-23", actual: 83.6 }, // plan 83.0
    { date: "2026-08-24", actual: 83.4, projected: 84 }, // saved projection wins
    { date: "2026-08-25", week: 2 },
    { date: "2026-08-26", actual: 83 },
    { date: "", actual: 1 },
  ];
  const now = new Date("2026-08-25T12:00:00Z");
  const rows = tableRows(log, cfg, now);
  assert.deepEqual(
    rows.map((r) => [r.index, r.key, r.vsProj.text, r.cumLoss, r.past, r.current, r.odd]),
    [
      [5, 5, "—", "-85.0 kg", false, true, true],
      [4, "2026-08-26", "+0.4", "-3.0 kg", false, false, false],
      [3, "2026-08-25", "—", null, true, false, true],
      [2, "2026-08-24", "-0.6", "-2.6 kg", true, true, false],
      [1, "2026-08-23", "+0.6", "-2.4 kg", true, false, true],
      [0, "2026-08-10", "—", "-1.0 kg", true, false, false],
    ],
  );
  assert.equal(rows[0].row, log[5]);
  assert.deepEqual(rows[5].twoWeek, { text: "—", tone: null });
  // 2-wk Loss from the readings: 26 Aug (wk of 24th) vs the 2 weeks before
  const long = [
    { date: "2026-08-03", actual: 86 },
    { date: "2026-08-12", actual: 85 },
    { date: "2026-08-24", actual: 84 },
    { date: "2026-08-26", actual: 83 },
  ];
  assert.deepEqual(tableRows(long, cfg, now)[0].twoWeek, { text: "-2.0 kg", tone: "up" });
  // a last row without a reading isn't current
  assert.deepEqual(
    tableRows([{ date: "a", actual: 1 }, { date: "b" }], cfg, now).map((r) => r.current),
    [false, true],
  );
  // a reading exactly now counts as past; an unreadable date doesn't
  const exact = tableRows([{ date: "2026-08-25" }, { date: "nope" }], cfg, new Date("2026-08-25"));
  assert.deepEqual(
    exact.map((r) => r.past),
    [false, true],
  );
});

test("editing a row", () => {
  const log = [{ date: "a", week: 1 }, { week: 2 }];
  assert.deepEqual(editedRow(log, 0, { dose: "5mg" }), { date: "a", week: 1, dose: "5mg" });
  assert.deepEqual(editedRow(log, 0, { week: null }), { date: "a", week: null });
  assert.equal(editedRow(log, 1, { dose: "x" }), null);
  assert.equal(editedRow(log, 5, { dose: "x" }), null);
  assert.deepEqual(log[0], { date: "a", week: 1 }); // untouched
});
