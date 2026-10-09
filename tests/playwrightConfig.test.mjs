// tests/playwrightConfig.test.mjs — the UI test projects (Fix 43.11.1): phone-*.spec.mjs files run
// in a "phone" project at 390 x 844; every other spec runs in "desktop"; no file runs in both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import config from "../playwright.config.mjs";

const project = (name) => config.projects.find((p) => p.name === name);
const runsIn = (p, file) => {
  const matches = (re) =>
    [re].flat().some((r) => (typeof r === "string" ? file.includes(r) : r.test(file)));
  return (!p.testMatch || matches(p.testMatch)) && !(p.testIgnore && matches(p.testIgnore));
};
const specs = readdirSync(new URL("./ui", import.meta.url)).filter((f) => f.endsWith(".spec.mjs"));

test("two projects: desktop and phone", () => {
  assert.deepEqual(
    config.projects.map((p) => p.name),
    ["desktop", "phone"],
  );
});

test("the phone project is a 390 x 844 screen", () => {
  assert.deepEqual(project("phone").use.viewport, { width: 390, height: 844 });
});

test("the desktop project keeps the 1400 x 900 window", () => {
  const viewport = project("desktop").use?.viewport ?? config.use.viewport;
  assert.deepEqual(viewport, { width: 1400, height: 900 });
});

test("each spec file runs in exactly one project", () => {
  for (const file of specs) {
    const inProjects = config.projects.filter((p) => runsIn(p, file)).map((p) => p.name);
    const expected = file.startsWith("phone-") ? ["phone"] : ["desktop"];
    assert.deepEqual(inProjects, expected, file);
  }
});
