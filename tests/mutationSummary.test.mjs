// tests/mutationSummary.test.mjs — scripts/mutation-summary.mjs: the score line of the weekly job (Fix 81)
import { test } from "node:test";
import assert from "node:assert/strict";
import { markdown, summarise } from "../scripts/mutation-summary.mjs";

const report = (statuses) => ({
  files: {
    "a.js": { mutants: statuses.slice(0, 3).map((status) => ({ status })) },
    "b.js": { mutants: statuses.slice(3).map((status) => ({ status })) },
  },
});

test("summarise: the score counts killed and timed-out mutants over all but the ones that errored", () => {
  const s = summarise(
    report([
      "Killed",
      "Killed",
      "Timeout",
      "Survived",
      "NoCoverage",
      "RuntimeError",
      "Killed",
      "Ignored",
    ]),
  );
  assert.ok(Math.abs(s.score - 66.6667) < 0.001); // 4 caught of 6 that count
  assert.deepEqual(
    { ...s, score: 0 },
    { score: 0, killed: 3, timeout: 1, survived: 1, noCoverage: 1 },
  );
});

test("summarise: nothing to score is 100%", () => {
  assert.equal(summarise({ files: {} }).score, 100);
});

test("markdown: the heading carries the title and the score to 2 dp, then the counts", () => {
  const text = markdown("API", {
    score: 99.0273,
    killed: 10,
    timeout: 1,
    survived: 2,
    noCoverage: 3,
  });
  assert.equal(
    text,
    "## API: mutation score 99.03%\n\nKilled 10, timeout 1, survived 2, no coverage 3. Report: the mutation-report artifact.\n",
  );
});
