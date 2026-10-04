// tests/medsLog.test.mjs — the Meds panel's view and saved document (Fix 26 PR 15)
import { test } from "node:test";
import assert from "node:assert/strict";
import { medsView, withEntry, medsDoc } from "../src/lib/medsLog.js";
import { medsForDate } from "../src/constants/meds.js";

test("view: the day's meds with text and filled; count", () => {
  const entries = {
    thyronorm: { text: "7:05" },
    esomeprazole: { done: true },
    probiotic: { text: "  " },
    other: { text: "x" },
  };
  const v = medsView("2026-10-01", entries);
  assert.deepEqual(
    v.meds.map((m) => [m.id, m.value, m.filled]),
    [
      ["thyronorm", "7:05", true],
      ["esomeprazole", "", true],
      ["probiotic", "  ", false],
      ["statin", "", false],
    ],
  );
  assert.deepEqual(v.meds[0], { ...medsForDate("2026-10-01")[0], value: "7:05", filled: true });
  assert.deepEqual([v.done, v.total], [2, 4]);
  assert.equal(medsView("2026-10-04", {}).total, 5); // Sunday: Vit D
});

test("typing replaces the entry; others kept, not mutated", () => {
  const entries = { a: { done: true }, b: { text: "x" } };
  assert.deepEqual(withEntry(entries, "a", "ok"), { a: { text: "ok" }, b: { text: "x" } });
  assert.deepEqual(entries.a, { done: true });
});

test("saved document", () => {
  const now = new Date("2026-10-04T09:00:00Z");
  assert.deepEqual(medsDoc({ a: { text: "1" } }, "2026-10-04", now), {
    entries: { a: { text: "1" } },
    date: "2026-10-04",
    updatedAt: "2026-10-04T09:00:00.000Z",
  });
});
