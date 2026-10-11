// tests/ui/cover.mjs — the Playwright `test` every UI spec uses (Fix 40).
// Normally identical to Playwright's. With UI_COVERAGE=1 each test also records which source files
// its page ran, into .ui-coverage/, for `npm run spec-map`.
import { test as base, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exercised } from "../../scripts/tier/specMap.mjs";

const OUT = ".ui-coverage";

// Fix 80: the sign-in panels slide up for 0.7 s (a 24 px move) every time a mode is picked, and a
// click aimed at a button while it moves can land on the panel behind it; on a loaded CI runner
// that failed about 1 test run in 100. Animations are off, and the panels that start transparent
// and only become visible by animating (.fade-up-2 to -4) are shown at once.
const NO_MOTION = `*, *::before, *::after { animation: none !important; transition: none !important; }
.fade-up-2, .fade-up-3, .fade-up-4 { opacity: 1 !important; }`;
const addNoMotion = (css) => {
  const add = () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
  };
  if (document.head) add();
  else document.addEventListener("DOMContentLoaded", add);
};

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
    await page.addInitScript(addNoMotion, NO_MOTION);
    if (process.env.UI_COVERAGE !== "1") return use(page);
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    save(testInfo, await page.coverage.stopJSCoverage());
  },
});

export { expect };
