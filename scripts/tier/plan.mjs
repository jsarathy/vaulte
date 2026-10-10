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

function uiLines(ui) {
  if (ui.mode === "none") return [];
  if (ui.mode === "full") return [`full UI suite locally${ui.why ? ` (${ui.why})` : ""}`];
  const n = ui.specs.length;
  return [`UI: ${n} spec${n === 1 ? "" : "s"}: npx playwright test ${ui.specs.join(" ")}`];
}

const TOP_TIER = ["API tests", "dependency audit and secret scan", "manual check on the live site"];

export function checksFor(tier, ui) {
  const base = ["lint and format", "unit tests", ...uiLines(ui)];
  return tier === 4 ? [...base, ...TOP_TIER] : base;
}
