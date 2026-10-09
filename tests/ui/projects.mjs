// tests/ui/projects.mjs — the UI test projects (Fix 43.11.1), with no imports so the unit tests can
// read them without installing Playwright. Used by playwright.config.mjs.
export const PHONE_SPECS = /phone-[^/]*\.spec\.mjs$/;
export const PHONE_SCREEN = { width: 390, height: 844 };
export const DESKTOP_SCREEN = { width: 1400, height: 900 };

export const PROJECTS = [
  { name: "desktop", testIgnore: PHONE_SPECS },
  { name: "phone", testMatch: PHONE_SPECS, use: { viewport: PHONE_SCREEN } },
];
