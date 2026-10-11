// tests/npm.test.mjs — scripts/npm.mjs starts npm on this OS (Fix 75: it failed on Windows).
import { test } from "node:test";
import assert from "node:assert/strict";
import { npm } from "../scripts/npm.mjs";

test("npm starts on this OS and prints its version", () => {
  assert.match(
    npm(["--version"], { stdio: ["ignore", "pipe", "ignore"] }).trim(),
    /^\d+\.\d+\.\d+/,
  );
});

test("a failing npm command throws and keeps what it printed", () => {
  try {
    npm(["run", "no-such-script-fix-75", "--silent"], { stdio: ["ignore", "pipe", "ignore"] });
    assert.fail("expected npm to exit non-zero");
  } catch (e) {
    assert.notEqual(e.status, 0);
    assert.equal(typeof e.stdout, "string");
  }
});
