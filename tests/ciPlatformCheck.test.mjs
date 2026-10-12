// tests/ciPlatformCheck.test.mjs — the weekly CI platform check (scripts/ci-platform-check.mjs, Fix 46):
// reading versions out of the workflows, deciding what is behind, and the report. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findingsFrom,
  firebaseToolsIn,
  isBehind,
  javaVersionsIn,
  majorOf,
  nodeVersionsIn,
  report,
  usesIn,
} from "../scripts/ci-platform-check.mjs";

const YAML = `
jobs:
  a:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '21'
      - name: tools
        run: npx --yes firebase-tools@15.32.1 emulators:exec --only firestore
      - uses: actions/cache@v4.2.1
  b:
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
`;

test("usesIn: each action and the version it is on", () => {
  assert.deepEqual(usesIn(YAML), [
    { repo: "actions/checkout", ref: "v4" },
    { repo: "actions/setup-node", ref: "v4" },
    { repo: "actions/setup-java", ref: "v5" },
    { repo: "actions/cache", ref: "v4.2.1" },
    { repo: "actions/setup-node", ref: "v4" },
  ]);
  assert.deepEqual(usesIn("run: echo uses nothing"), []);
});

test("node, java and firebase-tools versions are read, quoted or not", () => {
  assert.deepEqual(nodeVersionsIn(YAML), [24, 22]);
  assert.deepEqual(javaVersionsIn(YAML), [21]);
  assert.deepEqual(firebaseToolsIn(YAML), ["15.32.1"]);
  assert.deepEqual(nodeVersionsIn("nothing"), []);
  assert.deepEqual(firebaseToolsIn("firebase-tools@latest"), []);
});

test("majorOf and isBehind: only a higher major is behind; unknown is never behind", () => {
  assert.equal(majorOf("v4"), 4);
  assert.equal(majorOf("v4.2.1"), 4);
  assert.equal(majorOf(24), 24);
  assert.equal(majorOf("latest"), null);
  assert.equal(majorOf(undefined), null);
  assert.equal(isBehind("v4", "v5.0.1"), true);
  assert.equal(isBehind("v4", "v4.9.9"), false);
  assert.equal(isBehind("v5", "v4"), false);
  assert.equal(isBehind(21, 25), true);
  assert.equal(isBehind(25, 25), false);
  assert.equal(isBehind("main", "v5"), false);
  assert.equal(isBehind("v4", undefined), false);
});

test("findingsFrom: nothing behind and no notices gives no findings", () => {
  assert.deepEqual(
    findingsFrom({
      actions: [{ repo: "actions/checkout", ref: "v4", latest: "v4.2.2" }],
      node: { used: [24, 24], latest: 24 },
      java: { used: [25], latest: 25 },
      packages: [{ name: "firebase-tools", used: "15.32.1", latest: "15.32.1" }],
      notices: [],
    }),
    [],
  );
  assert.deepEqual(findingsFrom({}), []);
});

test("findingsFrom: what is behind and each distinct notice, one line each", () => {
  const out = findingsFrom({
    actions: [
      { repo: "actions/checkout", ref: "v4", latest: "v5.0.0" },
      { repo: "actions/cache", ref: "v4", latest: "v4.2.1" },
    ],
    node: { used: [22, 22, 24], latest: 24 },
    java: { used: [21], latest: 25 },
    packages: [
      { name: "@playwright/test", used: "1.55.0", latest: "1.56.1" },
      { name: "firebase-tools", used: "15.32.1", latest: "15.32.1" },
      { name: "no-version", used: "", latest: "2.0.0" },
    ],
    notices: ["Node 20 is deprecated", "Node 20 is deprecated", "ubuntu-latest will move to 26"],
  });
  assert.deepEqual(out, [
    "Action actions/checkout@v4 is behind: latest is v5.0.0",
    "Node 22 is behind the latest LTS, 24",
    "Java 21 is behind the latest LTS, 25",
    "@playwright/test 1.55.0 is not the latest (1.56.1)",
    "Notice on the latest CI run: Node 20 is deprecated",
    "Notice on the latest CI run: ubuntu-latest will move to 26",
  ]);
});

test("report: a heading with the date, then the findings or 'Nothing to update.'", () => {
  assert.equal(report([], "2026-10-18"), "CI platform check, 2026-10-18\n\nNothing to update.\n");
  assert.equal(
    report(["one", "two"], "2026-10-18"),
    "CI platform check, 2026-10-18\n\n- one\n- two\n\nRaise a Fix for each item that needs a change.\n",
  );
});
