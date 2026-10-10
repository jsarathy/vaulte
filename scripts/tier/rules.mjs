// scripts/tier/rules.mjs — Fix 40: fixed rules that set a change's tier from the file path alone.
// First match wins, so the riskiest rules come first. Edit this list to change how files are rated.
const RULES = [
  [/^(api|security|\.github)\//, 4, "API, security or CI file"],
  [
    /^(package(-lock)?\.json|firebase\.json|firestore\.rules|vercel\.json)$/,
    4,
    "dependency or deploy config",
  ],
  [/^(eslint|vite|playwright)\.config\./, 4, "build or test config"],
  [/^src\/firebase\.js$/, 4, "Firebase set-up"],
  [/^src\/.*(auth|account)/i, 4, "sign-in or account code"],
  [/^tests\/ui\/.*\.spec\.mjs$|^tests\/.*\.test\.mjs$/, 1, "test only"],
  [/^tests\//, 3, "shared test infrastructure"],
  [/^docs\/|\.md$/, 1, "documentation"],
  [/^scripts\//, 3, "build and CI script"],
  [
    /^src\/(main|App|NutritionTracker)\.jsx$|^src\/components\/Tracker(Frame|Tabs)\.jsx$/,
    3,
    "app shell",
  ],
];

export function pathRule(file) {
  const hit = RULES.find(([pattern]) => pattern.test(file));
  return hit ? { tier: hit[1], why: hit[2] } : null;
}
