// scripts/tier.mjs — Fix 40: rate a change 1–4 by how much of Vaulte it can break, and say what to run.
// Usage: npm run tier   (compares the working tree with origin/main)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pathRule } from "./tier/rules.mjs";
import { isScreen, reachedFrom, reachesShell, screensIn, importsFirebase } from "./tier/graph.mjs";

const CHECKS = {
  1: ["lint and format", "unit tests"],
  2: ["UI: the changed specs locally; CI runs the full sharded suite"],
  3: ["full UI suite locally", "mutation check on the new tests"],
  4: ["API tests", "dependency audit and secret scan", "manual check on the live site"],
};

export function checksFor(tier) {
  return Object.entries(CHECKS)
    .filter(([t]) => Number(t) <= tier)
    .flatMap(([, list]) => list)
    .filter((c) => tier < 3 || !/changed specs/.test(c));
}

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

export function tierOf(changed, modules) {
  const rated = changed.map((file) => ({ file, ...tierFor(file, modules) }));
  const tier = Math.max(1, ...rated.map((r) => r.tier));
  return {
    tier,
    reasons: rated.filter((r) => r.tier === tier).map((r) => `${r.file}: ${r.why}`),
    specs: changed.filter((f) => /^tests\/ui\/.*\.spec\.mjs$/.test(f)),
    checks: checksFor(tier),
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

async function main() {
  const { cruise } = await import("dependency-cruiser");
  const { output } = await cruise(["src", "api"], { exclude: { path: "node_modules" } });
  const r = tierOf(changedFiles(), output.modules);
  console.log(`Tier ${r.tier}`);
  r.reasons.forEach((x) => console.log(`  why: ${x}`));
  r.checks.forEach((x) => console.log(`  run: ${x}`));
  r.specs.forEach((x) => console.log(`  spec: ${x}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
