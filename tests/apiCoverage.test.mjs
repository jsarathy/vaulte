// tests/apiCoverage.test.mjs — Fix 68: the API test run prints coverage for the api/ folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;

test("test:api:run measures coverage of api/ only", () => {
  const cmd = scripts["test:api:run"];
  assert.match(cmd, /--experimental-test-coverage/);
  assert.match(cmd, /--test-coverage-include="api\/\*\*"/);
});

test("the unit coverage script still leaves out the tests themselves", () => {
  assert.match(scripts["test:coverage"], /--test-coverage-exclude=tests\/\*\*/);
});
