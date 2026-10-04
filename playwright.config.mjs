// UI tests (Fix 12): real components in the real page structure, mocked data.
// Run: npm run test:ui
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/ui",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false, // each file is one ordered flow
  workers: process.env.CI ? 2 : undefined,
  timeout: 120_000,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:5180",
    viewport: { width: 1400, height: 900 },
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npx vite --config tests/ui/harness/vite.config.js --port 5180 --strictPort",
    url: "http://localhost:5180/addentry.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
