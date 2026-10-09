import test from "node:test";
import assert from "node:assert/strict";
import { entryScript, verdict, BUDGET_BYTES } from "../scripts/bundle-check.mjs";

test("entryScript finds the module script in index.html", () => {
  const html =
    '<head><script type="module" crossorigin src="/assets/index-abc.js"></script></head>';
  assert.equal(entryScript(html), "/assets/index-abc.js");
});

test("entryScript returns null when there is none", () => {
  assert.equal(entryScript("<html></html>"), null);
});

test("verdict passes at the budget and fails one byte over", () => {
  assert.equal(verdict(BUDGET_BYTES).ok, true);
  assert.equal(verdict(BUDGET_BYTES + 1).ok, false);
});
