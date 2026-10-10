// scripts/tier.mjs — Fix 40: rate a change 1–4 by how much of Vaulte it can break, and say what to run.
// Usage: npm run tier   (compares the working tree with origin/main)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { pathRule } from "./tier/rules.mjs";
import { checksFor, uiPlan } from "./tier/plan.mjs";
import { isScreen, reachedFrom, reachesShell, screensIn, importsFirebase } from "./tier/graph.mjs";

function byReach(file, modules) {
  const reached = reachedFrom(modules, [file], isScreen);
  if (reachesShell(reached)) return { tier: 3, why: "used by the app shell, so every screen" };
  const n = screensIn(reached).length;
  return { tier: n >= 2 ? 3 : 2, why: `reaches ${n} screen${n === 1 ? "" : "s"}` };
}

export function tierFor(file, modules) {
  const rule = pathRule(file);
  if (rule) return rule;
  if (importsFirebase(modules, file)) return { tier: 4, why: "imports Firebase directly" };
  if (/^src\/.*\.jsx?$/.test(file)) return byReach(file, modules);
  return { tier: 3, why: "not covered by a tier rule" };
}

export function tierOf(changed, modules, map = {}) {
  const rated = changed.map((file) => ({ file, ...tierFor(file, modules) }));
  const tier = Math.max(1, ...rated.map((r) => r.tier));
  const ui = uiPlan(tier, changed, map);
  return {
    tier,
    reasons: rated.filter((r) => r.tier === tier).map((r) => `${r.file}: ${r.why}`),
    specs: ui.specs,
    checks: checksFor(tier, ui),
  };
}

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);

function changedFiles() {
  return [
    ...new Set([
      ...git("diff", "--name-only", "origin/main"),
      ...git("ls-files", "--others", "--exclude-standard"),
    ]),
  ];
}

// Rate the given files (default: everything changed since origin/main) against the real code.
export async function rateChange(given = []) {
  const { cruise } = await import("dependency-cruiser");
  const { output } = await cruise(["src", "api"], { exclude: { path: "node_modules" } });
  const map = JSON.parse(readFileSync("tests/ui/spec-map.json", "utf8"));
  const changed = given.length ? given : changedFiles();
  return { ...tierOf(changed, output.modules, map), changed, map };
}

async function main() {
  const r = await rateChange(process.argv.slice(2));
  console.log(`Tier ${r.tier}`);
  r.reasons.forEach((x) => console.log(`  why: ${x}`));
  r.checks.forEach((x) => console.log(`  run: ${x}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
