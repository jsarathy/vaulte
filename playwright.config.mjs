// UI tests (Fix 12): real components in the real page structure, mocked data.
// Run: npm run test:ui
import { defineConfig } from "@playwright/test";
import { PROJECTS, DESKTOP_SCREEN } from "./tests/ui/projects.mjs";
export default defineConfig({
  testDir: "tests/ui",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false, // each file is one ordered flow
  workers: process.env.CI ? "100%" : undefined, // one worker per core in CI (Fix 38)
  timeout: 120_000,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:5180",
    viewport: DESKTOP_SCREEN,
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  // Fix 43.11.1: phone-*.spec.mjs files run once, in the phone project; everything else on desktop.
  projects: PROJECTS,
  webServer: {
    command: "npx vite --config tests/ui/harness/vite.config.js --port 5180 --strictPort",
    url: "http://localhost:5180/addentry.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
