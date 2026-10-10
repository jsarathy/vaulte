// scripts/tier/plan.mjs — Fix 40: what to run before pushing, given a change's tier.
import { specsFor } from "./specMap.mjs";

// When the specs picked are at least this share of the suite, just run the whole suite.
const FULL_SHARE = 0.6;

const full = (why) => ({ mode: "full", specs: [], why });

// Files that change how everything builds or runs, so any spec could be affected.
const GLOBAL =
  /^(package(-lock)?\.json|(eslint|vite|playwright)\.config\.|\.github\/|vercel\.json)/;

export function uiPlan(tier, changed, map) {
  if (changed.some((f) => GLOBAL.test(f))) return full("build or CI config changed");
  const { specs, unmapped } = specsFor(changed, map);
  if (tier > 1 && unmapped.length) return full(`no spec exercises ${unmapped.join(", ")}`);
  const total = Object.keys(map).length;
  if (tier === 3 && specs.length >= FULL_SHARE * total) {
    return full(`${specs.length} of ${total} specs would run anyway`);
  }
  return specs.length ? { mode: "selected", specs } : { mode: "none", specs: [] };
}

function uiStep(ui) {
  if (ui.mode === "none") return [];
  if (ui.mode === "full") {
    return [
      { label: `full UI suite locally${ui.why ? ` (${ui.why})` : ""}`, cmds: ["npm run test:ui"] },
    ];
  }
  const n = ui.specs.length;
  const label = `UI: ${n} spec${n === 1 ? "" : "s"}: npx playwright test ${ui.specs.join(" ")}`;
  return [{ label, cmds: [`npx playwright test ${ui.specs.join(" ")}`] }];
}

const TOP_TIER = [
  { label: "API tests", cmds: ["npm run test:api"] },
  { label: "dependency audit (the secret scan runs in CI)", cmds: ["npm run audit:ci"] },
  { label: "manual check on the live site", cmds: [] },
];

// The steps to run before pushing: a label and the shell commands for each (none = done by hand).
export function stepsFor(tier, ui) {
  const base = [
    { label: "lint and format", cmds: ["npm run -s lint", "npm run -s format:check"] },
    { label: "unit tests", cmds: ["npm test"] },
    ...uiStep(ui),
  ];
  return tier === 4 ? [...base, ...TOP_TIER] : base;
}

export const checksFor = (tier, ui) => stepsFor(tier, ui).map((s) => s.label);
