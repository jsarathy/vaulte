import test from "node:test";
import assert from "node:assert/strict";
import { tierOf } from "../scripts/tier.mjs";
import { reachedFrom, screensIn } from "../scripts/tier/graph.mjs";

// A module as dependency-cruiser reports it: its path and what it imports.
const mod = (source, ...deps) => ({
  source,
  dependencies: deps.map((d) => ({ resolved: d, module: d })),
});
const firebase = (source) => ({
  source,
  dependencies: [{ resolved: "node_modules/firebase/firestore", module: "firebase/firestore" }],
});

// Two tabs, one hook used by both, one component used by one tab.
const GRAPH = [
  mod("src/tabs/AddEntry.jsx", "src/components/Card.jsx", "src/hooks/useShared.js"),
  mod("src/tabs/LogTab.jsx", "src/hooks/useShared.js"),
  mod("src/components/Card.jsx"),
  mod("src/hooks/useShared.js"),
  mod("src/components/TrackerTabs.jsx", "src/tabs/AddEntry.jsx", "src/tabs/LogTab.jsx"),
  firebase("src/hooks/useStore.js"),
  mod(
    "src/components/TrackerFrame.jsx",
    "src/hooks/useGlobal.js",
    "src/components/TrackerTabs.jsx",
  ),
  mod("src/hooks/useGlobal.js"),
  mod("src/App.jsx", "src/components/TrackerFrame.jsx"),
];

test("docs and markdown changes are tier 1", () => {
  assert.equal(tierOf(["docs/notes.md", "README.md"], GRAPH).tier, 1);
});

test("a test file alone is tier 1 and names the specs to run", () => {
  const r = tierOf(["tests/ui/polar-log.spec.mjs", "tests/polarLog.test.mjs"], GRAPH);
  assert.equal(r.tier, 1);
  assert.deepEqual(r.specs, ["tests/ui/polar-log.spec.mjs"]);
});

test("shared test infrastructure is tier 3", () => {
  assert.equal(tierOf(["tests/ui/harness/server.mjs"], GRAPH).tier, 3);
  assert.equal(tierOf(["tests/ui/fixtures/polar-detail.json"], GRAPH).tier, 3);
});

test("a component used by one screen is tier 2", () => {
  const r = tierOf(["src/components/Card.jsx"], GRAPH);
  assert.equal(r.tier, 2);
  assert.match(r.reasons[0], /Card\.jsx.*1 screen/);
});

test("a hook used by two screens is tier 3, found through the import graph", () => {
  const r = tierOf(["src/hooks/useShared.js"], GRAPH);
  assert.equal(r.tier, 3);
  assert.match(r.reasons[0], /2 screens/);
});

test("a file the app shell uses directly is tier 3 even though it reaches no screen", () => {
  const r = tierOf(["src/hooks/useGlobal.js"], GRAPH);
  assert.equal(r.tier, 3);
  assert.match(r.reasons[0], /app shell/);
});

test("a screen file itself is tier 2: it is one screen, not the shell above it", () => {
  const r = tierOf(["src/tabs/LogTab.jsx"], GRAPH);
  assert.equal(r.tier, 2);
  assert.match(r.reasons[0], /1 screen/);
});

test("reaching a screen does not carry on up through the shell", () => {
  assert.equal(tierOf(["src/components/Card.jsx"], GRAPH).tier, 2);
});

test("reachedFrom can stop expanding at chosen files", () => {
  const g = [mod("a.js", "b.js"), mod("b.js", "c.js"), mod("c.js")];
  const set = reachedFrom(g, ["c.js"], (f) => f === "b.js");
  assert.deepEqual([...set].sort(), ["b.js", "c.js"]);
});

test("the app shell is tier 3 whatever the graph says", () => {
  assert.equal(tierOf(["src/components/TrackerTabs.jsx"], GRAPH).tier, 3);
  assert.equal(tierOf(["src/App.jsx"], GRAPH).tier, 3);
});

test("api, config, dependencies and security files are tier 4", () => {
  for (const f of ["api/polar-sync.js", "package.json", "package-lock.json", "firebase.json"]) {
    assert.equal(tierOf([f], GRAPH).tier, 4, f);
  }
  assert.equal(tierOf([".github/workflows/ci.yml", "vercel.json"], GRAPH).tier, 4);
});

test("a src file that imports Firebase directly is tier 4", () => {
  const r = tierOf(["src/hooks/useStore.js"], GRAPH);
  assert.equal(r.tier, 4);
  assert.match(r.reasons[0], /Firebase/);
});

test("auth and account files are tier 4", () => {
  assert.equal(tierOf(["src/lib/authHistory.js"], GRAPH).tier, 4);
  assert.equal(tierOf(["src/components/AccountPage.jsx"], GRAPH).tier, 4);
});

test("a file the rules do not know is tier 3, not silently cheap", () => {
  assert.equal(tierOf(["index.html"], GRAPH).tier, 3);
});

test("the highest tier among the changed files wins, with its reason first", () => {
  const r = tierOf(["docs/a.md", "src/components/Card.jsx", "api/x.js"], GRAPH);
  assert.equal(r.tier, 4);
  assert.match(r.reasons[0], /api\/x\.js/);
});

test("no changes means tier 1", () => {
  assert.equal(tierOf([], GRAPH).tier, 1);
});

test("reachedFrom follows importers upward and survives import cycles", () => {
  const cyc = [mod("a.js", "b.js"), mod("b.js", "a.js"), mod("c.js", "a.js")];
  assert.deepEqual([...reachedFrom(cyc, ["a.js"])].sort(), ["a.js", "b.js", "c.js"]);
});

test("screensIn counts each tab once", () => {
  const set = new Set(["src/tabs/LogTab.jsx", "src/tabs/AddEntry.jsx", "src/hooks/x.js"]);
  assert.deepEqual(screensIn(set).sort(), ["src/tabs/AddEntry.jsx", "src/tabs/LogTab.jsx"]);
});
