import test from "node:test";
import assert from "node:assert/strict";
import { uiPlan, checksFor } from "../scripts/tier/plan.mjs";

// Ten specs; each exercises its own file, and "src/shared.js" is exercised by seven of them.
const SPECS = Array.from({ length: 10 }, (_, i) => `tests/ui/s${i}.spec.mjs`);
const MAP = Object.fromEntries(
  SPECS.map((spec, i) => [spec, [`src/f${i}.js`, ...(i < 7 ? ["src/shared.js"] : [])]]),
);

test("tier 1 with no changed spec runs no UI tests", () => {
  assert.deepEqual(uiPlan(1, ["docs/a.md"], MAP), { mode: "none", specs: [] });
});

test("tier 1 still runs a spec that was itself changed", () => {
  const r = uiPlan(1, [SPECS[2]], MAP);
  assert.deepEqual(r, { mode: "selected", specs: [SPECS[2]] });
});

test("tier 2 runs only the specs that exercise the changed file", () => {
  const r = uiPlan(2, ["src/f3.js"], MAP);
  assert.deepEqual(r, { mode: "selected", specs: [SPECS[3]] });
});

test("a changed file no spec exercises means the full suite, and says why", () => {
  const r = uiPlan(2, ["src/brand-new.js"], MAP);
  assert.equal(r.mode, "full");
  assert.match(r.why, /src\/brand-new\.js/);
});

test("tier 3 with a small selection runs just those specs", () => {
  const r = uiPlan(3, ["src/f1.js", "src/f8.js"], MAP);
  assert.equal(r.mode, "selected");
  assert.deepEqual(r.specs, [SPECS[1], SPECS[8]]);
});

test("tier 3 where the specs picked are most of the suite runs everything", () => {
  const r = uiPlan(3, ["src/shared.js"], MAP);
  assert.equal(r.mode, "full");
  assert.match(r.why, /7 of 10/);
});

test("an api-only change runs no UI specs, because the UI tests mock the api", () => {
  assert.deepEqual(uiPlan(4, ["api/x.js"], MAP), { mode: "none", specs: [] });
});

test("a tier 4 source file runs just the specs that exercise it", () => {
  assert.deepEqual(uiPlan(4, ["src/f2.js"], MAP), { mode: "selected", specs: [SPECS[2]] });
});

test("a dependency, build or CI config change runs the full suite", () => {
  for (const f of [
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "playwright.config.mjs",
    ".github/workflows/ci.yml",
  ]) {
    const r = uiPlan(4, [f], MAP);
    assert.equal(r.mode, "full", f);
    assert.match(r.why, /config/);
  }
});

test("checks: lint and unit tests always, then the UI plan, then the extras for tier 4", () => {
  const none = checksFor(1, { mode: "none", specs: [] });
  assert.deepEqual(none, ["lint and format", "unit tests"]);
  const some = checksFor(2, { mode: "selected", specs: [SPECS[0], SPECS[1]] });
  assert.ok(some.some((c) => /2 specs/.test(c) && /playwright test/.test(c)));
  const full = checksFor(3, { mode: "full", specs: [] });
  assert.ok(full.some((c) => /full UI suite/.test(c)));
  const top = checksFor(4, { mode: "full", specs: [] });
  assert.ok(top.some((c) => /API tests/.test(c)));
  assert.ok(top.some((c) => /live site/.test(c)));
  assert.ok(!full.some((c) => /live site/.test(c)));
});

test("checks name the specs so they can be copied", () => {
  const some = checksFor(2, { mode: "selected", specs: [SPECS[4]] });
  assert.ok(some.some((c) => c.includes(SPECS[4])));
});
