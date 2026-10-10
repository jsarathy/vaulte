import test from "node:test";
import assert from "node:assert/strict";
import { fileOfUrl, exercised, mergeRuns, specsFor } from "../scripts/tier/specMap.mjs";

// What Chromium reports for one script: the whole-module range first, then each function.
const fn = (name, count) => ({
  functionName: name,
  ranges: [{ startOffset: 0, endOffset: 9, count }],
});
const script = (url, ...functions) => ({ url, functions: [fn("", 1), ...functions] });

test("fileOfUrl turns a dev-server URL into a repo path", () => {
  assert.equal(
    fileOfUrl("http://localhost:5180/@fs/home/x/vaulte/src/tabs/AddEntry.jsx?t=123"),
    "src/tabs/AddEntry.jsx",
  );
  assert.equal(
    fileOfUrl("http://localhost:5180/../../../src/lib/polarLog.js"),
    "src/lib/polarLog.js",
  );
});

test("fileOfUrl ignores dependencies, the harness and other pages", () => {
  assert.equal(fileOfUrl("http://localhost:5180/node_modules/.vite/deps/react.js?v=1"), null);
  assert.equal(fileOfUrl("http://localhost:5180/tracker.html"), null);
  assert.equal(
    fileOfUrl("http://localhost:5180/@fs/home/x/vaulte/tests/ui/harness/mocks.js"),
    null,
  );
});

test("a file counts as exercised when one of its functions ran", () => {
  const ran = script("http://l/src/a.js", fn("render", 3));
  assert.deepEqual(exercised([ran]), ["src/a.js"]);
});

test("a file that was loaded but whose functions never ran is not exercised", () => {
  const idle = script("http://l/src/b.js", fn("render", 0));
  assert.deepEqual(exercised([idle]), []);
});

test("Vite's hot-reload helpers and anonymous wrappers do not count as the file running", () => {
  const loadedOnly = script("http://l/src/c.jsx", fn("Card", 0), fn("$RefreshReg$", 1), fn("", 1));
  assert.deepEqual(exercised([loadedOnly]), []);
});

test("a file with no functions (constants) counts as exercised once it is loaded", () => {
  assert.deepEqual(exercised([script("http://l/src/constants/meds.js")]), [
    "src/constants/meds.js",
  ]);
});

test("mergeRuns unions the files of every test in a spec, sorted", () => {
  const runs = [
    { spec: "tests/ui/a.spec.mjs", files: ["src/z.js", "src/a.js"] },
    { spec: "tests/ui/a.spec.mjs", files: ["src/m.js", "src/a.js"] },
    { spec: "tests/ui/b.spec.mjs", files: ["src/a.js"] },
  ];
  assert.deepEqual(mergeRuns(runs), {
    "tests/ui/a.spec.mjs": ["src/a.js", "src/m.js", "src/z.js"],
    "tests/ui/b.spec.mjs": ["src/a.js"],
  });
});

const MAP = {
  "tests/ui/x.spec.mjs": ["src/a.js", "src/b.js"],
  "tests/ui/y.spec.mjs": ["src/b.js"],
};

test("specsFor picks the specs that exercise a changed file", () => {
  assert.deepEqual(specsFor(["src/a.js"], MAP).specs, ["tests/ui/x.spec.mjs"]);
  assert.deepEqual(specsFor(["src/b.js"], MAP).specs, [
    "tests/ui/x.spec.mjs",
    "tests/ui/y.spec.mjs",
  ]);
});

test("specsFor always includes a changed spec", () => {
  const r = specsFor(["tests/ui/y.spec.mjs"], MAP);
  assert.deepEqual(r.specs, ["tests/ui/y.spec.mjs"]);
});

test("specsFor reports a changed source file no spec exercises, so the caller can run everything", () => {
  const r = specsFor(["src/new.js", "src/a.js"], MAP);
  assert.deepEqual(r.unmapped, ["src/new.js"]);
  assert.deepEqual(r.specs, ["tests/ui/x.spec.mjs"]);
});

test("specsFor ignores changed files that are not source (docs, config)", () => {
  assert.deepEqual(specsFor(["docs/a.md", "package.json"], MAP), { specs: [], unmapped: [] });
});
