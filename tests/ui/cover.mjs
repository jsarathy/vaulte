// tests/ui/cover.mjs — the Playwright `test` every UI spec uses (Fix 40).
// Normally identical to Playwright's. With UI_COVERAGE=1 each test also records which source files
// its page ran, into .ui-coverage/, for `npm run spec-map`.
import { test as base, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exercised } from "../../scripts/tier/specMap.mjs";

const OUT = ".ui-coverage";

function save(testInfo, scripts) {
  mkdirSync(OUT, { recursive: true });
  const spec = path.relative(process.cwd(), testInfo.file).split(path.sep).join("/");
  writeFileSync(
    path.join(OUT, `${testInfo.testId}.json`),
    JSON.stringify({ spec, files: exercised(scripts) }),
  );
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (process.env.UI_COVERAGE !== "1") return use(page);
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    save(testInfo, await page.coverage.stopJSCoverage());
  },
});

export { expect };
